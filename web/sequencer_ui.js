import { app } from "../../scripts/app.js";
import {
    스케줄_JSON,
    스케줄_동기화,
    이미지_수_정규화,
} from "./sequence_schedule.mjs";

const 템플릿_관리자_노드 = "WSQ_WildcardTemplateManager";
const 시퀀서_최소_높이 = 190;

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
            grid-template-rows: minmax(70px, 1fr) auto;
            gap: 7px;
            width: 100%;
            min-width: 310px;
            height: 100%;
            min-height: ${시퀀서_최소_높이}px;
            padding: 7px;
            overflow: hidden;
            color: var(--fg-color, #ddd);
            background: var(--comfy-menu-bg, #202020);
            border: 1px solid var(--border-color, #555);
            border-radius: 7px;
            font: 12px/1.35 system-ui, sans-serif;
        }

        .wsq-sequencer__rows {
            min-height: 0;
            overflow: auto;
            scrollbar-width: thin;
        }

        .wsq-sequencer__row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 72px;
            align-items: center;
            gap: 7px;
            min-height: 34px;
            padding: 4px 5px;
            border-radius: 5px;
        }

        .wsq-sequencer__row + .wsq-sequencer__row {
            margin-top: 2px;
        }

        .wsq-sequencer__row:hover {
            background: color-mix(in srgb, var(--p-primary-color, #6da7ff) 8%, transparent);
        }

        .wsq-sequencer__prompt {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .wsq-sequencer__count-wrap {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 3px;
            color: var(--descrip-text, #aaa);
        }

        .wsq-sequencer__count {
            box-sizing: border-box;
            width: 100%;
            min-height: 27px;
            padding: 3px 4px;
            color: var(--input-text, var(--fg-color, #eee));
            text-align: right;
            font: inherit;
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

        .wsq-sequencer__footer {
            min-height: 28px;
            padding: 5px 6px;
            color: var(--descrip-text, #aaa);
            text-align: right;
            font-variant-numeric: tabular-nums;
            border-top: 1px solid var(--border-color, #444);
        }

        .wsq-sequencer__empty {
            display: grid;
            height: 100%;
            min-height: 70px;
            place-items: center;
            padding: 12px;
            color: var(--descrip-text, #aaa);
            text-align: center;
        }
    `;
    document.head.append(style);
}

export function 시퀀서_수량_UI_연결(node) {
    const scheduleWidget = node.widgets?.find(
        (widget) => widget.name === "schedule_json",
    );
    if (!scheduleWidget) {
        console.warn("[Wildcard Sequencer] 수량 위젯을 찾지 못했습니다.");
        return;
    }

    scheduleWidget.hidden = true;
    스타일_설치();

    const root = document.createElement("section");
    root.className = "wsq-sequencer";
    root.setAttribute("aria-label", "템플릿별 생성 수량");

    const rowsContainer = document.createElement("div");
    rowsContainer.className = "wsq-sequencer__rows";
    const footer = document.createElement("div");
    footer.className = "wsq-sequencer__footer";
    root.append(rowsContainer, footer);

    let scheduleRows = [];
    let subscribedManager = null;
    let unsubscribeManager = null;
    let connectionFrame = 0;

    const 저장 = () => {
        위젯_값_저장(scheduleWidget, 스케줄_JSON(scheduleRows), node);
    };

    const 그리기 = () => {
        rowsContainer.replaceChildren();
        if (!subscribedManager) {
            const empty = document.createElement("div");
            empty.className = "wsq-sequencer__empty";
            empty.textContent = "Wildcard Template Manager를 연결하세요.";
            rowsContainer.append(empty);
            footer.textContent = "";
            return;
        }

        for (const row of scheduleRows) {
            const rowElement = document.createElement("div");
            rowElement.className = "wsq-sequencer__row";

            const prompt = document.createElement("span");
            prompt.className = "wsq-sequencer__prompt";
            prompt.textContent = row.prompt || "(빈 프롬프트)";
            prompt.title = row.prompt;

            const countWrap = document.createElement("label");
            countWrap.className = "wsq-sequencer__count-wrap";
            const countInput = document.createElement("input");
            countInput.type = "number";
            countInput.className = "wsq-sequencer__count";
            countInput.min = "1";
            countInput.max = "1000000";
            countInput.step = "1";
            countInput.value = String(row.image_count);
            countInput.setAttribute("aria-label", `${row.prompt} 이미지 수`);
            const unit = document.createElement("span");
            unit.textContent = "장";
            countWrap.append(countInput, unit);

            countInput.addEventListener("change", () => {
                row.image_count = 이미지_수_정규화(countInput.value);
                countInput.value = String(row.image_count);
                저장();
                합계_갱신();
            });

            rowElement.append(prompt, countWrap);
            rowsContainer.append(rowElement);
        }
        합계_갱신();
    };

    const 합계_갱신 = () => {
        const total = scheduleRows.reduce(
            (sum, row) => sum + row.image_count,
            0,
        );
        footer.textContent = `1회전 합계 ${total.toLocaleString()}장`;
    };

    const 관리자_행_동기화 = (templateRows) => {
        scheduleRows = 스케줄_동기화(templateRows, scheduleWidget.value);
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
            scheduleRows = [];
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
        const width = Math.max(node.size?.[0] ?? 0, 350);
        const computed = node.computeSize?.() ?? node.size;
        node.setSize?.([
            width,
            computed?.[1] ?? node.size?.[1] ?? 시퀀서_최소_높이,
        ]);
    });
}
