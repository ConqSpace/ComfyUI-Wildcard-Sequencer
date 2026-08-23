import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { 와일드카드_토큰_삽입 } from "./prompt_editing.mjs";
import { 폴더_와일드카드_추가 } from "./template_rows.mjs";

const 검색_최대_개수 = 40;
const 최대_템플릿_개수 = 256;
const 매니저_최소_높이 = 350;
const 검색기_열림_속성 = "wsq_manager_picker_expanded";

let 행_일련번호 = 0;
let 검색기_일련번호 = 0;

function 새_행_식별자() {
    행_일련번호 += 1;
    return `wsq-${Date.now().toString(36)}-${행_일련번호}`;
}

function 문자열_정리(value) {
    return String(value ?? "").trim();
}

function 이미지_수_정규화(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return 1;
    }
    return Math.min(1_000_000, Math.max(1, Math.trunc(number)));
}

function 행_정규화(row, 사용한_식별자) {
    if (!row || typeof row !== "object") {
        return null;
    }

    let id = 문자열_정리(row.id);
    if (!id || 사용한_식별자.has(id)) {
        id = 새_행_식별자();
    }
    사용한_식별자.add(id);

    return {
        id,
        prompt: String(row.prompt ?? ""),
        image_count: 이미지_수_정규화(row.image_count ?? 50),
    };
}

function 행_목록_읽기(value) {
    try {
        const parsed = JSON.parse(String(value ?? ""));
        if (!Array.isArray(parsed)) {
            return [];
        }

        const 사용한_식별자 = new Set();
        return parsed
            .slice(0, 최대_템플릿_개수)
            .map((row) => 행_정규화(row, 사용한_식별자))
            .filter(Boolean);
    } catch {
        return [];
    }
}

function 기본_행() {
    return {
        id: 새_행_식별자(),
        prompt: "portrait of __characters__",
        image_count: 50,
    };
}

function 위젯_값_저장(widget, value, node) {
    widget.value = value;
    widget.callback?.(value);
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
}

function 검색어_포함(item, query) {
    const 검색_대상 = item.token.toLocaleLowerCase();
    return query
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((낱말) => 검색_대상.includes(낱말));
}

function 항목_정규화(item) {
    const token = item && typeof item === "object"
        ? 문자열_정리(item.token)
        : "";
    return token ? { token } : null;
}

function 스타일_설치() {
    if (document.getElementById("wsq-template-manager-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "wsq-template-manager-style";
    style.textContent = `
        .wsq-manager {
            box-sizing: border-box;
            display: grid;
            grid-template-rows: auto minmax(94px, 1fr) auto;
            gap: 7px;
            width: 100%;
            min-width: 390px;
            height: 100%;
            min-height: ${매니저_최소_높이}px;
            padding: 7px;
            overflow: hidden;
            color: var(--fg-color, #ddd);
            background: var(--comfy-menu-bg, #202020);
            border: 1px solid var(--border-color, #555);
            border-radius: 7px;
            font: 12px/1.35 system-ui, sans-serif;
        }

        .wsq-manager button,
        .wsq-manager input,
        .wsq-manager textarea {
            font: inherit;
        }

        .wsq-manager__toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        .wsq-manager__add,
        .wsq-manager__bulk,
        .wsq-manager__refresh,
        .wsq-manager__toggle,
        .wsq-manager__remove,
        .wsq-manager__drag,
        .wsq-manager__result {
            color: inherit;
            background: transparent;
            border: 0;
            border-radius: 4px;
            cursor: pointer;
        }

        .wsq-manager__add,
        .wsq-manager__bulk,
        .wsq-manager__refresh {
            min-height: 28px;
            padding: 4px 9px;
            background: var(--comfy-input-bg, #303030);
            border: 1px solid var(--border-color, #555);
            font-weight: 650;
        }

        .wsq-manager__actions {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .wsq-manager__refresh {
            width: 30px;
            padding: 4px;
        }

        .wsq-manager__bulk:disabled,
        .wsq-manager__refresh:disabled {
            opacity: .45;
            cursor: wait;
        }

        .wsq-manager__add:hover,
        .wsq-manager__bulk:hover:not(:disabled),
        .wsq-manager__refresh:hover:not(:disabled) {
            background: color-mix(in srgb, var(--p-primary-color, #6da7ff) 14%, var(--comfy-input-bg, #303030));
        }

        .wsq-manager__add:active,
        .wsq-manager__bulk:active:not(:disabled),
        .wsq-manager__refresh:active:not(:disabled) {
            transform: scale(.97);
        }

        .wsq-manager__rows {
            min-height: 0;
            overflow: auto;
            scrollbar-width: thin;
        }

        .wsq-manager__row {
            display: grid;
            grid-template-columns: 24px minmax(0, 1fr) 24px;
            align-items: stretch;
            gap: 5px;
            padding: 4px;
            border: 1px solid transparent;
            border-radius: 6px;
        }

        .wsq-manager__row + .wsq-manager__row {
            margin-top: 3px;
        }

        .wsq-manager__row[data-active="true"] {
            background: color-mix(in srgb, var(--p-primary-color, #6da7ff) 12%, transparent);
            border-color: color-mix(in srgb, var(--p-primary-color, #6da7ff) 55%, transparent);
        }

        .wsq-manager__row[data-dragging="true"] {
            opacity: .5;
        }

        .wsq-manager__drag,
        .wsq-manager__remove {
            padding: 0;
            color: var(--descrip-text, #aaa);
        }

        .wsq-manager__drag {
            cursor: grab;
            touch-action: none;
        }

        .wsq-manager__drag:active {
            cursor: grabbing;
        }

        .wsq-manager__remove:hover {
            color: #ff8f8f;
            background: color-mix(in srgb, #ff6666 14%, transparent);
        }

        .wsq-manager__remove:disabled {
            opacity: .3;
            cursor: default;
        }

        .wsq-manager__prompt,
        .wsq-manager__search {
            box-sizing: border-box;
            width: 100%;
            color: var(--input-text, var(--fg-color, #eee));
            background: var(--comfy-input-bg, #151515);
            border: 1px solid var(--border-color, #555);
            border-radius: 4px;
            outline: none;
        }

        .wsq-manager__prompt {
            min-height: 42px;
            padding: 5px 7px;
            resize: none;
        }

        .wsq-manager__finder {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            min-height: 29px;
            overflow: hidden;
            border-top: 1px solid var(--border-color, #444);
        }

        .wsq-manager__toggle {
            display: grid;
            grid-template-columns: 16px minmax(0, 1fr);
            align-items: center;
            width: 100%;
            min-height: 29px;
            padding: 4px 2px;
            text-align: left;
            font-weight: 650;
        }

        .wsq-manager__toggle:hover,
        .wsq-manager__result:hover,
        .wsq-manager__drag:hover {
            background: var(--comfy-input-bg, #303030);
        }

        .wsq-manager__finder-content {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 5px;
            min-height: 0;
            padding-top: 4px;
        }

        .wsq-manager__finder-content[hidden] {
            display: none;
        }

        .wsq-manager__search {
            min-height: 28px;
            padding: 4px 7px;
        }

        .wsq-manager__results {
            min-height: 0;
            overflow: auto;
            scrollbar-width: thin;
        }

        .wsq-manager__result {
            display: block;
            width: 100%;
            padding: 5px 6px;
            overflow: hidden;
            color: var(--p-primary-color, #8bb7ff);
            text-align: left;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: ui-monospace, Consolas, monospace;
            font-weight: 700;
        }

        .wsq-manager__message {
            padding: 12px 6px;
            color: var(--descrip-text, #aaa);
            text-align: center;
        }

        .wsq-manager button:focus-visible,
        .wsq-manager input:focus-visible,
        .wsq-manager textarea:focus-visible {
            outline: 2px solid var(--p-primary-color, #6da7ff);
            outline-offset: 1px;
        }
    `;
    document.head.append(style);
}

function 메시지_표시(container, text) {
    const message = document.createElement("div");
    message.className = "wsq-manager__message";
    message.textContent = text;
    container.replaceChildren(message);
}

export function 템플릿_관리자_연결(node) {
    const templatesWidget = node.widgets?.find(
        (widget) => widget.name === "templates_json",
    );
    const directoryWidget = node.widgets?.find(
        (widget) => widget.name === "wildcard_directory",
    );

    if (!templatesWidget || !directoryWidget) {
        console.warn("[Wildcard Sequencer] Manager 입력 위젯을 찾지 못했습니다.");
        return;
    }

    templatesWidget.hidden = true;
    스타일_설치();

    const root = document.createElement("section");
    root.className = "wsq-manager";
    root.setAttribute("aria-label", "와일드카드 템플릿 관리자");

    const toolbar = document.createElement("div");
    toolbar.className = "wsq-manager__toolbar";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "wsq-manager__add";
    addButton.textContent = "+ 템플릿";

    const actions = document.createElement("div");
    actions.className = "wsq-manager__actions";
    const bulkButton = document.createElement("button");
    bulkButton.type = "button";
    bulkButton.className = "wsq-manager__bulk";
    bulkButton.textContent = "전체 추가";
    bulkButton.title = "폴더와 하위 폴더의 와일드카드를 템플릿으로 추가";
    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "wsq-manager__refresh";
    refreshButton.textContent = "↻";
    refreshButton.title = "와일드카드 목록 새로고침";
    refreshButton.setAttribute("aria-label", "와일드카드 목록 새로고침");
    actions.append(bulkButton, refreshButton);
    toolbar.append(addButton, actions);

    const rowsContainer = document.createElement("div");
    rowsContainer.className = "wsq-manager__rows";

    검색기_일련번호 += 1;
    const finderContentId = `wsq-manager-finder-${검색기_일련번호}`;
    const finder = document.createElement("div");
    finder.className = "wsq-manager__finder";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "wsq-manager__toggle";
    toggle.setAttribute("aria-controls", finderContentId);
    const chevron = document.createElement("span");
    chevron.setAttribute("aria-hidden", "true");
    const toggleLabel = document.createElement("span");
    toggleLabel.textContent = "토큰 찾기";
    toggle.append(chevron, toggleLabel);

    const finderContent = document.createElement("div");
    finderContent.id = finderContentId;
    finderContent.className = "wsq-manager__finder-content";

    const search = document.createElement("input");
    search.type = "search";
    search.className = "wsq-manager__search";
    search.placeholder = "토큰명 검색";
    search.setAttribute("aria-label", "와일드카드 토큰명 검색");

    const results = document.createElement("div");
    results.className = "wsq-manager__results";
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-live", "polite");
    finderContent.append(search, results);
    finder.append(toggle, finderContent);
    root.append(toolbar, rowsContainer, finder);

    let rows = 행_목록_읽기(templatesWidget.value);
    if (!rows.length) {
        rows = [기본_행()];
    }
    let activeRowId = rows[0].id;
    let activePromptInput = null;
    let cursorStart = rows[0].prompt.length;
    let cursorEnd = cursorStart;
    let draggedRowId = null;
    let items = [];
    let loading = false;
    let errorMessage = "";
    let requestNumber = 0;
    let expanded = false;
    let searchFrame = 0;
    let directoryTimer = 0;
    let actionTimer = 0;
    const rowListeners = new Set();

    const 행_알림 = () => {
        const snapshot = rows.map((row) => ({ ...row }));
        for (const listener of rowListeners) {
            listener(snapshot);
        }
    };

    node.wsqGetTemplateRows = () => rows.map((row) => ({ ...row }));
    node.wsqSubscribeTemplateRows = (listener) => {
        rowListeners.add(listener);
        return () => rowListeners.delete(listener);
    };

    const 저장 = () => {
        위젯_값_저장(templatesWidget, JSON.stringify(rows), node);
        행_알림();
    };

    const 활성_행_표시 = () => {
        for (const element of rowsContainer.children) {
            element.dataset.active = String(element.dataset.rowId === activeRowId);
        }
    };

    const 행_선택 = (row, input = null) => {
        activeRowId = row.id;
        if (input) {
            activePromptInput = input;
            cursorStart = input.selectionStart ?? input.value.length;
            cursorEnd = input.selectionEnd ?? cursorStart;
        }
        활성_행_표시();
    };

    const 행_이동 = (rowId, offset) => {
        const oldIndex = rows.findIndex((row) => row.id === rowId);
        const newIndex = Math.min(rows.length - 1, Math.max(0, oldIndex + offset));
        if (oldIndex < 0 || oldIndex === newIndex) {
            return;
        }
        const [moved] = rows.splice(oldIndex, 1);
        rows.splice(newIndex, 0, moved);
        저장();
        행_그리기();
    };

    const 행_그리기 = () => {
        rowsContainer.replaceChildren();
        activePromptInput = null;

        for (const row of rows) {
            const rowElement = document.createElement("div");
            rowElement.className = "wsq-manager__row";
            rowElement.dataset.rowId = row.id;
            rowElement.dataset.active = String(row.id === activeRowId);

            const dragHandle = document.createElement("button");
            dragHandle.type = "button";
            dragHandle.className = "wsq-manager__drag";
            dragHandle.textContent = "≡";
            dragHandle.draggable = true;
            dragHandle.title = "드래그 또는 방향키로 순서 변경";
            dragHandle.setAttribute("aria-label", "템플릿 순서 변경");

            const promptInput = document.createElement("textarea");
            promptInput.className = "wsq-manager__prompt";
            promptInput.rows = 2;
            promptInput.value = row.prompt;
            promptInput.placeholder = "프롬프트와 __wildcard__ 토큰";
            promptInput.setAttribute("aria-label", "프롬프트 템플릿");

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "wsq-manager__remove";
            removeButton.textContent = "×";
            removeButton.disabled = rows.length === 1;
            removeButton.title = rows.length === 1
                ? "마지막 템플릿은 삭제할 수 없습니다."
                : "템플릿 삭제";
            removeButton.setAttribute("aria-label", "템플릿 삭제");

            const 선택_기억 = () => 행_선택(row, promptInput);
            promptInput.addEventListener("focus", 선택_기억);
            promptInput.addEventListener("click", 선택_기억);
            promptInput.addEventListener("keyup", 선택_기억);
            promptInput.addEventListener("select", 선택_기억);
            promptInput.addEventListener("input", () => {
                row.prompt = promptInput.value;
                선택_기억();
                저장();
            });

            removeButton.addEventListener("click", () => {
                if (rows.length === 1) {
                    return;
                }
                const index = rows.findIndex((item) => item.id === row.id);
                rows.splice(index, 1);
                if (activeRowId === row.id) {
                    activeRowId = rows[Math.min(index, rows.length - 1)].id;
                }
                저장();
                행_그리기();
            });

            dragHandle.addEventListener("keydown", (event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    행_이동(row.id, event.key === "ArrowUp" ? -1 : 1);
                }
            });
            dragHandle.addEventListener("dragstart", (event) => {
                draggedRowId = row.id;
                rowElement.dataset.dragging = "true";
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", row.id);
            });
            dragHandle.addEventListener("dragend", () => {
                draggedRowId = null;
                rowElement.dataset.dragging = "false";
            });
            rowElement.addEventListener("dragover", (event) => {
                if (draggedRowId && draggedRowId !== row.id) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                }
            });
            rowElement.addEventListener("drop", (event) => {
                event.preventDefault();
                const sourceId = draggedRowId || event.dataTransfer.getData("text/plain");
                const sourceIndex = rows.findIndex((item) => item.id === sourceId);
                const targetIndex = rows.findIndex((item) => item.id === row.id);
                if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
                    return;
                }
                const [moved] = rows.splice(sourceIndex, 1);
                rows.splice(targetIndex, 0, moved);
                activeRowId = moved.id;
                저장();
                행_그리기();
            });

            rowElement.append(dragHandle, promptInput, removeButton);
            rowsContainer.append(rowElement);

            if (row.id === activeRowId) {
                activePromptInput = promptInput;
            }
        }
    };

    const 검색_그리기 = () => {
        if (loading) {
            메시지_표시(results, "목록을 불러오는 중입니다.");
            return;
        }
        if (errorMessage) {
            메시지_표시(results, errorMessage);
            return;
        }

        const query = search.value.trim();
        const filtered = (query
            ? items.filter((item) => 검색어_포함(item, query))
            : items
        ).slice(0, 검색_최대_개수);
        results.replaceChildren();

        if (!filtered.length) {
            메시지_표시(
                results,
                query ? "일치하는 와일드카드가 없습니다." : "와일드카드가 없습니다.",
            );
            return;
        }

        for (const item of filtered) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "wsq-manager__result";
            button.textContent = `__${item.token}__`;
            button.setAttribute("role", "option");
            button.addEventListener("pointerdown", (event) => event.preventDefault());
            button.addEventListener("click", () => {
                const row = rows.find((candidate) => candidate.id === activeRowId);
                if (!row || !activePromptInput) {
                    return;
                }
                const insertion = 와일드카드_토큰_삽입(
                    row.prompt,
                    cursorStart,
                    cursorEnd,
                    item.token,
                );
                row.prompt = insertion.value;
                activePromptInput.value = row.prompt;
                cursorStart = insertion.cursor;
                cursorEnd = insertion.cursor;
                activePromptInput.focus({ preventScroll: true });
                activePromptInput.setSelectionRange(cursorStart, cursorEnd);
                저장();
            });
            results.append(button);
        }
    };

    const 목록_불러오기 = async () => {
        requestNumber += 1;
        const thisRequest = requestNumber;
        loading = true;
        bulkButton.disabled = true;
        refreshButton.disabled = true;
        errorMessage = "";
        검색_그리기();

        try {
            const query = new URLSearchParams({
                root: 문자열_정리(directoryWidget.value),
            });
            const response = await api.fetchApi(
                `/wildcard-sequencer/wildcards?${query.toString()}`,
                { method: "GET" },
            );
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data || !Array.isArray(data.items)) {
                throw new Error("응답 형식이 올바르지 않습니다.");
            }
            if (thisRequest !== requestNumber) {
                return null;
            }
            items = data.items.map(항목_정규화).filter(Boolean);
            return items;
        } catch (error) {
            if (thisRequest !== requestNumber) {
                return null;
            }
            items = [];
            errorMessage = `불러오기 실패: ${error instanceof Error ? error.message : String(error)}`;
            return null;
        } finally {
            if (thisRequest === requestNumber) {
                loading = false;
                bulkButton.disabled = false;
                refreshButton.disabled = false;
                검색_그리기();
            }
        }
    };

    const 펼침_적용 = (nextExpanded, saveState = false, focusSearch = false) => {
        expanded = Boolean(nextExpanded);
        finderContent.hidden = !expanded;
        toggle.setAttribute("aria-expanded", String(expanded));
        chevron.textContent = expanded ? "▾" : "▸";
        root.style.gridTemplateRows = expanded
            ? "auto minmax(94px, 3fr) minmax(160px, 2fr)"
            : "auto minmax(94px, 1fr) auto";
        if (saveState) {
            node.properties ??= {};
            node.properties[검색기_열림_속성] = expanded;
            app.graph?.setDirtyCanvas?.(true, true);
        }
        if (expanded && focusSearch) {
            requestAnimationFrame(() => search.focus({ preventScroll: true }));
        }
    };

    addButton.addEventListener("click", () => {
        if (rows.length >= 최대_템플릿_개수) {
            return;
        }
        const row = {
            id: 새_행_식별자(),
            prompt: "",
            image_count: 50,
        };
        rows.push(row);
        activeRowId = row.id;
        저장();
        행_그리기();
        requestAnimationFrame(() => {
            activePromptInput?.focus({ preventScroll: true });
            rowsContainer.scrollTop = rowsContainer.scrollHeight;
        });
    });
    refreshButton.addEventListener("click", async () => {
        const loadedItems = await 목록_불러오기();
        if (loadedItems === null) {
            return;
        }
        clearTimeout(actionTimer);
        refreshButton.textContent = "✓";
        actionTimer = setTimeout(() => {
            refreshButton.textContent = "↻";
        }, 1400);
    });
    bulkButton.addEventListener("click", async () => {
        const loadedItems = await 목록_불러오기();
        if (loadedItems === null) {
            return;
        }

        const imported = 폴더_와일드카드_추가(
            rows,
            loadedItems,
            새_행_식별자,
            최대_템플릿_개수,
        );
        rows = imported.rows;
        if (imported.added > 0) {
            activeRowId = rows.at(-1).id;
            저장();
            행_그리기();
            requestAnimationFrame(() => {
                rowsContainer.scrollTop = rowsContainer.scrollHeight;
            });
        }

        clearTimeout(actionTimer);
        bulkButton.textContent = imported.limited > 0
            ? `${imported.added}개 추가 · 한도 도달`
            : imported.added > 0
                ? `${imported.added}개 추가됨`
                : "추가할 항목 없음";
        actionTimer = setTimeout(() => {
            bulkButton.textContent = "전체 추가";
        }, 1800);
    });
    toggle.addEventListener("click", () => {
        const nextExpanded = !expanded;
        펼침_적용(nextExpanded, true, nextExpanded);
        if (nextExpanded) {
            목록_불러오기();
        }
    });
    search.addEventListener("input", () => {
        cancelAnimationFrame(searchFrame);
        searchFrame = requestAnimationFrame(검색_그리기);
    });
    search.addEventListener("keydown", (event) => {
        const firstResult = results.querySelector(".wsq-manager__result");
        if (event.key === "Enter" && firstResult) {
            event.preventDefault();
            firstResult.click();
        } else if (event.key === "ArrowDown" && firstResult) {
            event.preventDefault();
            firstResult.focus();
        }
    });

    const originalDirectoryCallback = directoryWidget.callback;
    directoryWidget.callback = function () {
        const returnValue = originalDirectoryCallback?.apply(this, arguments);
        if (expanded) {
            clearTimeout(directoryTimer);
            directoryTimer = setTimeout(목록_불러오기, 180);
        }
        return returnValue;
    };

    node.addDOMWidget("template_manager", "WSQ_TEMPLATE_MANAGER", root, {
        serialize: false,
        hideOnZoom: true,
        // 최대 높이를 지정하지 않아 노드 세로 리사이즈의 남는 공간을 모두 받습니다.
        getMinHeight: () => 매니저_최소_높이,
    });

    const originalConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        const returnValue = originalConfigure?.apply(this, arguments);
        queueMicrotask(() => {
            const loadedRows = 행_목록_읽기(templatesWidget.value);
            rows = loadedRows.length ? loadedRows : [기본_행()];
            activeRowId = rows[0].id;
            행_그리기();
            const normalizedValue = JSON.stringify(rows);
            if (!loadedRows.length || normalizedValue !== templatesWidget.value) {
                저장();
            } else {
                행_알림();
            }
            const savedExpanded = info?.properties?.[검색기_열림_속성] === true;
            펼침_적용(savedExpanded);
            if (savedExpanded) {
                목록_불러오기();
            }
        });
        return returnValue;
    };

    const originalRemoved = node.onRemoved;
    node.onRemoved = function () {
        cancelAnimationFrame(searchFrame);
        clearTimeout(directoryTimer);
        clearTimeout(actionTimer);
        rowListeners.clear();
        delete node.wsqGetTemplateRows;
        delete node.wsqSubscribeTemplateRows;
        return originalRemoved?.apply(this, arguments);
    };

    저장();
    행_그리기();
    펼침_적용(node.properties?.[검색기_열림_속성] === true);
    requestAnimationFrame(() => {
        const width = Math.max(node.size?.[0] ?? 0, 430);
        const computed = node.computeSize?.() ?? node.size;
        node.setSize?.([
            width,
            computed?.[1] ?? node.size?.[1] ?? 매니저_최소_높이,
        ]);
    });
}
