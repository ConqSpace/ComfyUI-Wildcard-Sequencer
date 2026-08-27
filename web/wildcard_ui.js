import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { 와일드카드_토큰_삽입 } from "./prompt_editing.mjs";
import { 시퀀서_수량_UI_연결 } from "./sequencer_ui.js";
import { 템플릿_관리자_연결 } from "./template_manager_ui.js";
import { 와일드카드_검색 } from "./wildcard_search.mjs";

const 템플릿_노드 = "WSQ_WildcardTemplate";
const 템플릿_관리자_노드 = "WSQ_WildcardTemplateManager";
const 새_시퀀서_노드 = "WSQ_WildcardSequenceRunner";
const 시퀀서_노드들 = new Set([
    새_시퀀서_노드,
    "WSQ_WildcardSequencer",
]);
const 검색기_열림_속성 = "wsq_picker_expanded";
const 검색기_접힌_높이 = 40;
const 검색기_펼친_높이 = 200;
let 선택기_일련번호 = 0;

function 세션_식별자_만들기() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/*
 * ComfyUI는 처리 중 들어온 큐 요청을 배열의 끝에서 꺼낸다. 이 상태도 같은
 * LIFO 규칙을 따라야 실제 직렬화되는 요청과 queue_group이 어긋나지 않는다.
 */
const 큐_상태 = {
    세션: 세션_식별자_만들기(),
    현재: null,
    대기: [],
};

function 큐_요청_만들기(requestId, batchCount) {
    return {
        requestId,
        batchCount,
        노드별_인덱스: new Map(),
    };
}

function 큐_시작_처리(event) {
    const 상세 = event?.detail ?? {};
    const 요청 = 큐_요청_만들기(상세.requestId, 상세.batchCount);
    큐_상태.대기.push(요청);
}

function 큐_완료_처리(event) {
    const requestId = event?.detail?.requestId;

    if (큐_상태.현재?.requestId === requestId) {
        /*
         * 다음 요청은 여기서 미리 고르지 않는다. 코어도 다음 beforeQueued 직전에
         * queueItems.pop()으로 선택하므로, 그때 대기 스택의 끝을 맞춰 꺼낸다.
         */
        큐_상태.현재 = null;
        return;
    }

    // 비정상적인 이벤트 순서에서도 오래된 요청이 다음 작업을 오염시키지 않게 한다.
    const 대기_위치 = 큐_상태.대기.findIndex(
        (요청) => 요청.requestId === requestId,
    );
    if (대기_위치 >= 0) {
        큐_상태.대기.splice(대기_위치, 1);
    }
}

api.addEventListener("promptQueueing", 큐_시작_처리);
api.addEventListener("promptQueued", 큐_완료_처리);

function 현재_직렬화_값(node) {
    if (큐_상태.현재 === null) {
        큐_상태.현재 = 큐_상태.대기.pop() ?? null;
    }

    const 요청 = 큐_상태.현재;

    if (요청 === null) {
        // 정상 큐 경로에서는 발생하지 않지만 API 변화 시에도 유효한 값을 남긴다.
        return {
            queueGroup: `${큐_상태.세션}:독립`,
            queueIndex: 0,
        };
    }

    const 현재_인덱스 = 요청.노드별_인덱스.get(node) ?? 0;
    요청.노드별_인덱스.set(node, 현재_인덱스 + 1);

    return {
        queueGroup: `${큐_상태.세션}:${요청.requestId}`,
        queueIndex: 현재_인덱스,
    };
}

function 시퀀서_직렬화_연결(node) {
    const queueGroupWidget = node.widgets?.find(
        (widget) => widget.name === "queue_group",
    );
    const queueIndexWidget = node.widgets?.find(
        (widget) => widget.name === "queue_index",
    );
    const imagesPerExecutionWidget = node.widgets?.find(
        (widget) => widget.name === "images_per_execution",
    );

    if (!queueGroupWidget || !queueIndexWidget || !imagesPerExecutionWidget) {
        console.warn(
            "[Wildcard Sequencer] 내부 실행 위젯을 찾지 못했습니다.",
        );
        return;
    }

    /*
     * 세 값은 프롬프트 직렬화에는 필요하지만 사용자가 편집할 값은 아니다.
     * ComfyUI는 숨긴 위젯에도 beforeQueued를 호출하므로 화면에서만 제외한다.
     */
    queueGroupWidget.hidden = true;
    queueIndexWidget.hidden = true;
    imagesPerExecutionWidget.hidden = true;

    const 기존_호출 = queueGroupWidget.beforeQueued;
    queueGroupWidget.beforeQueued = function () {
        기존_호출?.apply(this, arguments);

        /*
         * 한 노드에서 이 위젯 하나만 카운터를 전진시킨다. 따라서 그래프에
         * Sequencer가 여러 개 있어도 각 노드가 0, 1, 2…를 동일하게 받는다.
         */
        const 값 = 현재_직렬화_값(node);
        queueGroupWidget.value = 값.queueGroup;
        queueIndexWidget.value = 값.queueIndex;
    };

    requestAnimationFrame(() => {
        const 계산_크기 = node.computeSize?.() ?? node.size;
        node.setSize?.([
            node.size?.[0] ?? 계산_크기?.[0] ?? 0,
            계산_크기?.[1] ?? node.size?.[1] ?? 0,
        ]);
    });
}

function 스타일_설치() {
    if (document.getElementById("wsq-wildcard-picker-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "wsq-wildcard-picker-style";
    style.textContent = `
        .wsq-picker {
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            width: 100%;
            min-width: 280px;
            height: ${검색기_펼친_높이}px;
            padding: 5px 7px 7px;
            overflow: hidden;
            color: var(--fg-color, #ddd);
            background: var(--comfy-menu-bg, #202020);
            border: 1px solid var(--border-color, #555);
            border-radius: 7px;
            font: 12px/1.35 system-ui, sans-serif;
        }

        .wsq-picker[data-collapsed="true"] {
            height: ${검색기_접힌_높이}px;
            padding-bottom: 5px;
        }

        .wsq-picker__toggle {
            box-sizing: border-box;
            display: grid;
            grid-template-columns: 16px minmax(0, 1fr);
            align-items: center;
            gap: 5px;
            width: 100%;
            min-height: 28px;
            padding: 3px 2px;
            color: inherit;
            text-align: left;
            background: transparent;
            border: 0;
            border-radius: 4px;
            cursor: pointer;
        }

        .wsq-picker__toggle:hover {
            background: var(--comfy-input-bg, #303030);
        }

        .wsq-picker__toggle:active {
            transform: scale(.99);
        }

        .wsq-picker__toggle:focus-visible,
        .wsq-picker__search:focus-visible,
        .wsq-picker__item:focus-visible {
            outline: 2px solid var(--p-primary-color, #6da7ff);
            outline-offset: 1px;
        }

        .wsq-picker__chevron {
            color: var(--descrip-text, #aaa);
            text-align: center;
        }

        .wsq-picker__toggle-label {
            overflow: hidden;
            font-weight: 650;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .wsq-picker__content {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            gap: 6px;
            min-height: 0;
            padding-top: 4px;
        }

        .wsq-picker__content[hidden] {
            display: none;
        }

        .wsq-picker__search {
            box-sizing: border-box;
            width: 100%;
            min-height: 29px;
            color: var(--input-text, var(--fg-color, #eee));
            background: var(--comfy-input-bg, #151515);
            border: 1px solid var(--border-color, #555);
            border-radius: 5px;
        }

        .wsq-picker__search {
            flex: 1 1 auto;
            min-width: 0;
            padding: 4px 8px;
            outline: none;
        }

        .wsq-picker__results {
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
            border-top: 1px solid var(--border-color, #444);
            scrollbar-width: thin;
        }

        .wsq-picker__item {
            display: block;
            width: 100%;
            padding: 6px;
            color: inherit;
            text-align: left;
            background: transparent;
            border: 0;
            border-radius: 4px;
            cursor: pointer;
        }

        .wsq-picker__item:hover,
        .wsq-picker__item:focus-visible {
            background: var(--comfy-input-bg, #303030);
        }

        .wsq-picker__token {
            overflow: hidden;
            display: block;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .wsq-picker__token {
            color: var(--p-primary-color, #8bb7ff);
            font-family: ui-monospace, Consolas, monospace;
            font-weight: 700;
        }

        .wsq-picker__message {
            padding: 18px 6px;
            color: var(--descrip-text, #aaa);
            text-align: center;
        }
    `;
    document.head.append(style);
}

function 문자열_정리(value) {
    return String(value ?? "").trim();
}

function 항목_정규화(item) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const token = 문자열_정리(item.token);
    if (!token) {
        return null;
    }

    return {
        token,
    };
}

function 위젯_값_알리기(widget, value, node) {
    widget.value = value;
    widget.callback?.(value);
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
}

function 템플릿_선택_추적(templateWidget) {
    const 상태 = {
        시작: String(templateWidget.value ?? "").length,
        끝: String(templateWidget.value ?? "").length,
    };

    const 현재_선택_기억 = () => {
        const 활성 = document.activeElement;
        if (!(활성 instanceof HTMLTextAreaElement)) {
            return;
        }

        /*
         * Vue Nodes와 레거시 캔버스 편집기는 DOM 구조가 다르므로 내부 요소를
         * 직접 참조하지 않고, 현재 위젯 값과 일치하는 편집기만 안전하게 추적한다.
         */
        if (활성.value !== String(templateWidget.value ?? "")) {
            return;
        }

        상태.시작 = 활성.selectionStart ?? 활성.value.length;
        상태.끝 = 활성.selectionEnd ?? 상태.시작;
    };

    const 이벤트들 = ["selectionchange", "keyup", "mouseup", "focusout"];
    for (const 이벤트 of 이벤트들) {
        document.addEventListener(이벤트, 현재_선택_기억, true);
    }

    return {
        상태,
        해제() {
            for (const 이벤트 of 이벤트들) {
                document.removeEventListener(이벤트, 현재_선택_기억, true);
            }
        },
    };
}

function 와일드카드_삽입(templateWidget, item, node, 선택) {
    const 원문 = String(templateWidget.value ?? "");
    const insertion = 와일드카드_토큰_삽입(
        원문,
        선택.시작,
        선택.끝,
        item.token,
    );

    선택.시작 = insertion.cursor;
    선택.끝 = insertion.cursor;
    위젯_값_알리기(templateWidget, insertion.value, node);
}

function 결과_버튼_만들기(item, 삽입) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wsq-picker__item";
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", `${item.token} 와일드카드 삽입`);

    const token = document.createElement("span");
    token.className = "wsq-picker__token";
    token.textContent = `__${item.token}__`;

    button.append(token);

    // 검색 결과를 눌러도 템플릿 편집기의 마지막 커서 위치를 잃지 않는다.
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => 삽입(item));
    return button;
}

function 메시지_표시(container, text) {
    const message = document.createElement("div");
    message.className = "wsq-picker__message";
    message.textContent = text;
    container.replaceChildren(message);
}

function 와일드카드_선택기_연결(node) {
    const templateNameWidget = node.widgets?.find(
        (widget) => widget.name === "template_name",
    );
    const templateWidget = node.widgets?.find(
        (widget) => widget.name === "template",
    );
    const directoryWidget = node.widgets?.find(
        (widget) => widget.name === "wildcard_directory",
    );

    if (!templateNameWidget || !templateWidget || !directoryWidget) {
        console.warn(
            "[Wildcard Sequencer] Template 입력 위젯을 찾지 못했습니다.",
        );
        return;
    }

    // 초기 버전과 저장 형식은 호환하면서 효과 없는 이름 입력만 화면에서 감춘다.
    templateNameWidget.hidden = true;

    스타일_설치();
    선택기_일련번호 += 1;
    const 결과_식별자 = `wsq-results-${선택기_일련번호}`;
    const 내용_식별자 = `wsq-picker-content-${선택기_일련번호}`;

    const root = document.createElement("section");
    root.className = "wsq-picker";
    root.setAttribute("aria-label", "와일드카드 검색 선택기");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "wsq-picker__toggle";
    toggle.setAttribute("aria-controls", 내용_식별자);

    const chevron = document.createElement("span");
    chevron.className = "wsq-picker__chevron";
    chevron.setAttribute("aria-hidden", "true");

    const toggleLabel = document.createElement("span");
    toggleLabel.className = "wsq-picker__toggle-label";
    toggleLabel.textContent = "토큰 찾기";

    toggle.append(chevron, toggleLabel);

    const content = document.createElement("div");
    content.id = 내용_식별자;
    content.className = "wsq-picker__content";

    const search = document.createElement("input");
    search.type = "search";
    search.className = "wsq-picker__search";
    search.placeholder = "토큰명 검색";
    search.setAttribute("aria-label", "와일드카드 토큰명 검색");
    search.setAttribute("aria-controls", 결과_식별자);

    const results = document.createElement("div");
    results.id = 결과_식별자;
    results.className = "wsq-picker__results";
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "와일드카드 검색 결과");
    results.setAttribute("aria-live", "polite");

    content.append(search, results);
    root.append(toggle, content);

    const 커서 = 템플릿_선택_추적(templateWidget);
    let 항목들 = [];
    let 불러오는_중 = false;
    let 오류 = "";
    let 요청_번호 = 0;
    let 현재_디렉터리 = 문자열_정리(directoryWidget.value);
    let 검색_프레임 = 0;
    let 펼침 = false;

    const 노드_크기_맞추기 = () => {
        requestAnimationFrame(() => {
            const 계산_크기 = node.computeSize?.() ?? node.size;
            node.setSize?.([
                Math.max(node.size?.[0] ?? 0, 300),
                계산_크기?.[1] ?? node.size?.[1] ?? 0,
            ]);
            node.setDirtyCanvas?.(true, true);
        });
    };

    const 펼침_적용 = (다음_펼침, 저장 = false, 포커스 = false) => {
        펼침 = Boolean(다음_펼침);
        root.dataset.collapsed = String(!펼침);
        content.hidden = !펼침;
        toggle.setAttribute("aria-expanded", String(펼침));
        toggle.title = 펼침 ? "와일드카드 검색 접기" : "와일드카드 검색 펼치기";
        chevron.textContent = 펼침 ? "▾" : "▸";

        if (저장) {
            node.properties ??= {};
            node.properties[검색기_열림_속성] = 펼침;
            app.graph?.setDirtyCanvas?.(true, true);
        }

        노드_크기_맞추기();
        if (펼침 && 포커스) {
            requestAnimationFrame(() => search.focus({ preventScroll: true }));
        }
    };

    const 선택_삽입 = (item) => {
        와일드카드_삽입(templateWidget, item, node, 커서.상태);
        그리기();
    };

    const 그리기 = () => {
        if (불러오는_중) {
            메시지_표시(results, "목록을 불러오는 중입니다.");
            return;
        }

        if (오류) {
            메시지_표시(results, 오류);
            return;
        }

        const query = search.value.trim();
        const 검색_결과 = 와일드카드_검색(항목들, query);

        results.replaceChildren();

        if (!검색_결과.length) {
            const message = document.createElement("div");
            message.className = "wsq-picker__message";
            message.textContent = query
                ? "일치하는 와일드카드가 없습니다."
                : "이 폴더에는 와일드카드가 없습니다.";
            results.append(message);
            return;
        }

        for (const item of 검색_결과) {
            results.append(결과_버튼_만들기(item, 선택_삽입));
        }
    };

    const 목록_불러오기 = async (강제 = false) => {
        const directory = 문자열_정리(directoryWidget.value);
        if (!강제 && directory === 현재_디렉터리 && 항목들.length) {
            return;
        }

        현재_디렉터리 = directory;
        요청_번호 += 1;
        const 이_요청 = 요청_번호;
        불러오는_중 = true;
        오류 = "";
        그리기();

        try {
            const query = new URLSearchParams({ root: directory });
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

            if (이_요청 !== 요청_번호) {
                return;
            }

            항목들 = data.items.map(항목_정규화).filter(Boolean);
        } catch (error) {
            if (이_요청 !== 요청_번호) {
                return;
            }

            항목들 = [];
            오류 = `불러오기 실패: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            if (이_요청 === 요청_번호) {
                불러오는_중 = false;
                그리기();
            }
        }
    };

    search.addEventListener("input", () => {
        cancelAnimationFrame(검색_프레임);
        검색_프레임 = requestAnimationFrame(그리기);
    });
    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            const 첫_결과 = results.querySelector(".wsq-picker__item");
            if (첫_결과) {
                event.preventDefault();
                첫_결과.click();
            }
        } else if (event.key === "ArrowDown") {
            const 첫_결과 = results.querySelector(".wsq-picker__item");
            if (첫_결과) {
                event.preventDefault();
                첫_결과.focus();
            }
        }
    });
    toggle.addEventListener("click", () => {
        const 다음_펼침 = !펼침;
        펼침_적용(다음_펼침, true, 다음_펼침);
        if (다음_펼침) {
            목록_불러오기(true);
        }
    });

    const 기존_디렉터리_호출 = directoryWidget.callback;
    let 디렉터리_타이머 = 0;
    directoryWidget.callback = function () {
        const 반환값 = 기존_디렉터리_호출?.apply(this, arguments);
        if (!펼침) {
            return 반환값;
        }
        clearTimeout(디렉터리_타이머);
        디렉터리_타이머 = setTimeout(() => 목록_불러오기(true), 180);
        return 반환값;
    };

    node.addDOMWidget("wildcard_picker", "WSQ_WILDCARD_PICKER", root, {
        serialize: false,
        hideOnZoom: true,
        getMinHeight: () =>
            펼침 ? 검색기_펼친_높이 : 검색기_접힌_높이,
        getHeight: () =>
            펼침 ? 검색기_펼친_높이 : 검색기_접힌_높이,
    });

    const 기존_구성 = node.onConfigure;
    node.onConfigure = function (정보) {
        const 반환값 = 기존_구성?.apply(this, arguments);
        const 저장된_펼침 = 정보?.properties?.[검색기_열림_속성] === true;
        펼침_적용(저장된_펼침);
        if (저장된_펼침) {
            목록_불러오기(true);
        }
        return 반환값;
    };

    const 기존_제거 = node.onRemoved;
    node.onRemoved = function () {
        cancelAnimationFrame(검색_프레임);
        clearTimeout(디렉터리_타이머);
        커서.해제();
        return 기존_제거?.apply(this, arguments);
    };

    펼침_적용(node.properties?.[검색기_열림_속성] === true);
    if (펼침) {
        목록_불러오기(true);
    }
}

app.registerExtension({
    name: "WildcardSequencer.SearchPickerAndQueueContext",
    nodeCreated(node) {
        const 노드_종류 =
            node.comfyClass ?? node.constructor?.comfyClass ?? node.type;

        if (노드_종류 === 템플릿_관리자_노드) {
            템플릿_관리자_연결(node);
        } else if (노드_종류 === 템플릿_노드) {
            와일드카드_선택기_연결(node);
        } else if (시퀀서_노드들.has(노드_종류)) {
            if (노드_종류 === 새_시퀀서_노드) {
                시퀀서_수량_UI_연결(node);
            }
            시퀀서_직렬화_연결(node);
        }
    },
});
