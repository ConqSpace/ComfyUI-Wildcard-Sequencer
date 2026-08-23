import { app } from "../../scripts/app.js";
import {
    공통_수량_JSON,
    공통_수량_읽기,
    이미지_수_정규화,
} from "./sequence_schedule.mjs";

const 템플릿_관리자_노드 = "WSQ_WildcardTemplateManager";
const 시퀀서_최소_높이 = 112;

function 노드_종류(node) {
    return node?.comfyClass ?? node?.constructor?.comfyClass ?? node?.type;
}

function 위젯_값_저장(widget, value, node) {
    widget.value = value;
    widget.callback?.(value);
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
}

function 템플릿_행_읽기(managerNode) {
    if (typeof managerNode?.wsqGetTemplateRows === "function") {
        return managerNode.wsqGetTemplateRows();
    }

    const widget = managerNode?.widgets?.find(
        (candidate) => candidate.name === "templates_json",
    );
    try {
        const parsed = JSON.parse(String(widget?.value ?? ""));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function 연결된_관리자_찾기(node) {
    const input = node.inputs?.find((candidate) => candidate.name === "templates");
    const linkId = input?.link;
    if (linkId === undefined || linkId === null) {
        return null;
    }

    const links = app.graph?.links;
    const link = links instanceof Map ? links.get(linkId) : links?.[linkId];
    const originId = link?.origin_id ?? link?.originId;
    if (originId === undefined || originId === null) {
        return null;
    }

    const managerNode = app.graph?.getNodeById?.(originId);
    return 노드_종류(managerNode) === 템플릿_관리자_노드
        ? managerNode
        : null;
}

function 스타일_설치() {
    if (document.getElementById("wsq-sequencer-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "wsq-sequencer-style";
    style.textContent = `
        .wsq-sequencer {
            box-sizing: border-box;
            display: grid;
            grid-template-rows: minmax(44px, 1fr) auto;
            gap: 8px;
            width: 100%;
            min-width: 300px;
            height: 100%;
            min-height: ${시퀀서_최소_높이}px;
            padding: 8px;
            color: var(--fg-color, #ddd);
            background: var(--comfy-menu-bg, #202020);
            border: 1px solid var(--border-color, #555);
            border-radius: 7px;
            font: 12px/1.35 system-ui, sans-serif;
        }

        .wsq-sequencer__control {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 86px;
            align-items: center;
            gap: 12px;
            padding: 5px 7px;
        }

        .wsq-sequencer__label {
            font-weight: 650;
        }

        .wsq-sequencer__count-wrap {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 4px;
            color: var(--descrip-text, #aaa);
        }

        .wsq-sequencer__count {
            box-sizing: border-box;
            width: 100%;
            min-height: 30px;
            padding: 4px 6px;
            color: var(--input-text, var(--fg-color, #eee));
            text-align: right;
            font: inherit;
            font-weight: 650;
            font-variant-numeric: tabular-nums;
            background: var(--comfy-input-bg, #151515);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            outline: none;
        }

        .wsq-sequencer__count:focus-visible {
            outline: 2px solid var(--p-primary-color, #6da7ff);
            outline-offset: 1px;
        }

        .wsq-sequencer__summary {
            min-height: 28px;
            padding: 6px 7px;
            color: var(--descrip-text, #aaa);
            text-align: right;
            font-variant-numeric: tabular-nums;
            border-top: 1px solid var(--border-color, #444);
        }

    `;
    document.head.append(style);
}

export function 시퀀서_수량_UI_연결(node) {
    const scheduleWidget = node.widgets?.find(
        (widget) => widget.name === "schedule_json",
    );
    if (!scheduleWidget) {
        console.warn("[Wildcard Sequencer] 공통 수량 위젯을 찾지 못했습니다.");
        return;
    }

    scheduleWidget.hidden = true;
    스타일_설치();

    const root = document.createElement("section");
    root.className = "wsq-sequencer";
    root.setAttribute("aria-label", "템플릿 공통 생성 수량");

    const content = document.createElement("div");
    const summary = document.createElement("div");
    summary.className = "wsq-sequencer__summary";
    root.append(content, summary);

    let templateRows = [];
    let commonCount = 공통_수량_읽기([], scheduleWidget.value);
    let subscribedManager = null;
    let unsubscribeManager = null;
    let connectionFrame = 0;

    const 저장 = () => {
        위젯_값_저장(scheduleWidget, 공통_수량_JSON(commonCount), node);
    };

    const 그리기 = () => {
        content.replaceChildren();
        const control = document.createElement("label");
        control.className = "wsq-sequencer__control";
        const label = document.createElement("span");
        label.className = "wsq-sequencer__label";
        label.textContent = "템플릿당 이미지 수";

        const countWrap = document.createElement("span");
        countWrap.className = "wsq-sequencer__count-wrap";
        const countInput = document.createElement("input");
        countInput.type = "number";
        countInput.className = "wsq-sequencer__count";
        countInput.min = "1";
        countInput.max = "1000000";
        countInput.step = "1";
        countInput.value = String(commonCount);
        countInput.setAttribute("aria-label", "템플릿당 이미지 수");
        const unit = document.createElement("span");
        unit.textContent = "장";
        countWrap.append(countInput, unit);
        control.append(label, countWrap);
        content.append(control);

        countInput.addEventListener("change", () => {
            commonCount = 이미지_수_정규화(countInput.value);
            countInput.value = String(commonCount);
            저장();
            합계_갱신();
        });
        합계_갱신();
    };

    const 합계_갱신 = () => {
        if (!subscribedManager) {
            summary.textContent = "Manager를 연결하면 1회전 합계를 계산합니다.";
            return;
        }
        const total = templateRows.length * commonCount;
        summary.textContent = `${templateRows.length}개 템플릿 · 1회전 ${total.toLocaleString()}장`;
    };

    const 관리자_행_동기화 = (nextTemplateRows) => {
        templateRows = nextTemplateRows;
        commonCount = 공통_수량_읽기(templateRows, scheduleWidget.value);
        저장();
        그리기();
    };

    const 관리자_연결_동기화 = () => {
        const manager = 연결된_관리자_찾기(node);
        if (manager !== subscribedManager) {
            unsubscribeManager?.();
            unsubscribeManager = null;
            subscribedManager = manager;

            if (manager && typeof manager.wsqSubscribeTemplateRows === "function") {
                unsubscribeManager = manager.wsqSubscribeTemplateRows(
                    관리자_행_동기화,
                );
            }
        }

        if (!manager) {
            templateRows = [];
            그리기();
            return;
        }
        관리자_행_동기화(템플릿_행_읽기(manager));
    };

    const 연결_예약 = () => {
        cancelAnimationFrame(connectionFrame);
        connectionFrame = requestAnimationFrame(관리자_연결_동기화);
    };

    const originalBeforeQueued = scheduleWidget.beforeQueued;
    scheduleWidget.beforeQueued = function () {
        originalBeforeQueued?.apply(this, arguments);
        관리자_연결_동기화();
    };

    node.addDOMWidget("sequence_schedule", "WSQ_SEQUENCE_SCHEDULE", root, {
        serialize: false,
        hideOnZoom: true,
        getMinHeight: () => 시퀀서_최소_높이,
    });

    const originalConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function () {
        const returnValue = originalConnectionsChange?.apply(this, arguments);
        연결_예약();
        return returnValue;
    };

    const originalConfigure = node.onConfigure;
    node.onConfigure = function () {
        const returnValue = originalConfigure?.apply(this, arguments);
        queueMicrotask(연결_예약);
        return returnValue;
    };

    const originalRemoved = node.onRemoved;
    node.onRemoved = function () {
        cancelAnimationFrame(connectionFrame);
        unsubscribeManager?.();
        return originalRemoved?.apply(this, arguments);
    };

    연결_예약();
    requestAnimationFrame(() => {
        const width = Math.max(node.size?.[0] ?? 0, 340);
        const computed = node.computeSize?.() ?? node.size;
        node.setSize?.([
            width,
            computed?.[1] ?? node.size?.[1] ?? 시퀀서_최소_높이,
        ]);
    });
}
