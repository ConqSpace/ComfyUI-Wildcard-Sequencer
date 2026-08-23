import { app } from "../../scripts/app.js";
import {
    이미지_수_정규화,
    이전_공통_수량_읽기,
    회전_합계_문구,
} from "./sequence_schedule.mjs";

const 템플릿_관리자_노드 = "WSQ_WildcardTemplateManager";

function 노드_종류(node) {
    return node?.comfyClass ?? node?.constructor?.comfyClass ?? node?.type;
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

export function 시퀀서_수량_UI_연결(node) {
    const scheduleWidget = node.widgets?.find(
        (widget) => widget.name === "schedule_json",
    );
    const countWidget = node.widgets?.find(
        (widget) => widget.name === "images_per_template",
    );
    if (!scheduleWidget || !countWidget) {
        console.warn("[Wildcard Sequencer] 공통 수량 위젯을 찾지 못했습니다.");
        return;
    }

    // 이전 JSON은 워크플로 위치 호환용이며 새 UI에서는 기본 숫자 위젯만 노출합니다.
    scheduleWidget.hidden = true;
    const countWidgetIndex = node.widgets.indexOf(countWidget);
    const summaryWidget = node.addWidget(
        "text",
        "wsq_cycle_summary",
        "Manager 연결 전",
        () => {},
        {
            read_only: true,
            disabled: true,
            serialize: false,
            hideInPanel: true,
        },
    );
    summaryWidget.label = "1회전 합계";
    summaryWidget.serialize = false;
    summaryWidget.disabled = true;
    summaryWidget.options ??= {};
    summaryWidget.options.read_only = true;
    summaryWidget.options.disabled = true;
    summaryWidget.options.serialize = false;
    summaryWidget.options.hideInPanel = true;

    let templateRows = [];
    let subscribedManager = null;
    let unsubscribeManager = null;
    let connectionFrame = 0;
    let migrationPending = false;

    const originalCountCallback = countWidget.callback;

    const 합계_갱신 = () => {
        if (!subscribedManager) {
            summaryWidget.value = "Manager 연결 전";
        } else {
            const count = 이미지_수_정규화(countWidget.value);
            summaryWidget.value = 회전_합계_문구(templateRows.length, count);
        }
        node.setDirtyCanvas?.(true, true);
        app.graph?.setDirtyCanvas?.(true, true);
    };

    const 이전_데이터_비우기 = () => {
        scheduleWidget.value = "[]";
    };

    const 이전_수량_적용 = () => {
        if (!migrationPending) {
            return;
        }
        const migratedCount = 이전_공통_수량_읽기(
            templateRows,
            scheduleWidget.value,
        );
        if (migratedCount === null) {
            return;
        }

        countWidget.value = migratedCount;
        originalCountCallback?.call(countWidget, migratedCount);
        이전_데이터_비우기();
        migrationPending = false;
        app.graph?.setDirtyCanvas?.(true, true);
    };

    countWidget.callback = function (value) {
        const returnValue = originalCountCallback?.apply(this, arguments);
        const normalized = 이미지_수_정규화(value);
        if (this.value !== normalized) {
            this.value = normalized;
        }
        migrationPending = false;
        이전_데이터_비우기();
        합계_갱신();
        return returnValue;
    };

    const 관리자_행_동기화 = (nextTemplateRows) => {
        templateRows = nextTemplateRows;
        이전_수량_적용();
        합계_갱신();
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
            이전_수량_적용();
            합계_갱신();
            return;
        }
        관리자_행_동기화(템플릿_행_읽기(manager));
    };

    const 연결_예약 = () => {
        cancelAnimationFrame(connectionFrame);
        connectionFrame = requestAnimationFrame(관리자_연결_동기화);
    };

    const originalBeforeQueued = countWidget.beforeQueued;
    countWidget.beforeQueued = function () {
        originalBeforeQueued?.apply(this, arguments);
        관리자_연결_동기화();
    };

    const originalConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function () {
        const returnValue = originalConnectionsChange?.apply(this, arguments);
        연결_예약();
        return returnValue;
    };

    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        const returnValue = originalConfigure?.apply(this, arguments);
        const savedValues = info?.widgets_values;
        migrationPending = Array.isArray(savedValues)
            && savedValues.length <= countWidgetIndex;
        queueMicrotask(연결_예약);
        return returnValue;
    };

    const originalRemoved = node.onRemoved;
    node.onRemoved = function () {
        cancelAnimationFrame(connectionFrame);
        unsubscribeManager?.();
        return originalRemoved?.apply(this, arguments);
    };

    합계_갱신();
    연결_예약();
}
