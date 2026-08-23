import { 폴더_내용_만들기 } from "./template_rows.mjs";

let 폴더_선택기_일련번호 = 0;

function 스타일_설치() {
    if (document.getElementById("wsq-folder-picker-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "wsq-folder-picker-style";
    style.textContent = `
        .wsq-folder-picker {
            box-sizing: border-box;
            width: min(520px, calc(100vw - 32px));
            max-height: min(620px, calc(100vh - 32px));
            padding: 0;
            overflow: hidden;
            color: var(--fg-color, #ddd);
            background: var(--comfy-menu-bg, #202020);
            border: 1px solid var(--border-color, #555);
            border-radius: 9px;
            box-shadow: 0 16px 48px rgba(0, 0, 0, .34);
            font: 12px/1.35 system-ui, sans-serif;
        }

        .wsq-folder-picker::backdrop {
            background: rgba(0, 0, 0, .52);
        }

        .wsq-folder-picker__layout {
            display: grid;
            grid-template-rows: auto auto minmax(180px, 1fr) auto;
            max-height: min(620px, calc(100vh - 32px));
        }

        .wsq-folder-picker__header,
        .wsq-folder-picker__footer {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px;
        }

        .wsq-folder-picker__header {
            justify-content: space-between;
            border-bottom: 1px solid var(--border-color, #444);
        }

        .wsq-folder-picker__title {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
        }

        .wsq-folder-picker__close,
        .wsq-folder-picker__crumb,
        .wsq-folder-picker__folder,
        .wsq-folder-picker__cancel,
        .wsq-folder-picker__import {
            color: inherit;
            font: inherit;
            border-radius: 5px;
            cursor: pointer;
        }

        .wsq-folder-picker__close,
        .wsq-folder-picker__crumb,
        .wsq-folder-picker__folder {
            background: transparent;
            border: 0;
        }

        .wsq-folder-picker__close {
            width: 32px;
            height: 32px;
            color: var(--descrip-text, #aaa);
            font-size: 18px;
        }

        .wsq-folder-picker__path {
            display: flex;
            align-items: center;
            min-height: 42px;
            padding: 5px 12px;
            overflow-x: auto;
            color: var(--descrip-text, #aaa);
            border-bottom: 1px solid var(--border-color, #444);
            scrollbar-width: thin;
        }

        .wsq-folder-picker__crumb {
            min-height: 30px;
            padding: 4px 6px;
            white-space: nowrap;
        }

        .wsq-folder-picker__crumb[aria-current="page"] {
            color: var(--fg-color, #eee);
            font-weight: 650;
        }

        .wsq-folder-picker__separator {
            color: var(--descrip-text, #777);
        }

        .wsq-folder-picker__list {
            min-height: 180px;
            padding: 6px;
            overflow: auto;
            scrollbar-width: thin;
        }

        .wsq-folder-picker__folder,
        .wsq-folder-picker__file {
            box-sizing: border-box;
            display: grid;
            grid-template-columns: 18px minmax(0, 1fr) 18px;
            align-items: center;
            gap: 8px;
            width: 100%;
            min-height: 38px;
            padding: 7px 9px;
            text-align: left;
        }

        .wsq-folder-picker__folder:hover,
        .wsq-folder-picker__close:hover,
        .wsq-folder-picker__crumb:hover {
            background: color-mix(in srgb, var(--p-primary-color, #6da7ff) 10%, transparent);
        }

        .wsq-folder-picker__folder:active,
        .wsq-folder-picker__close:active,
        .wsq-folder-picker__crumb:active,
        .wsq-folder-picker__cancel:active,
        .wsq-folder-picker__import:active {
            transform: scale(.97);
        }

        .wsq-folder-picker__file {
            color: var(--descrip-text, #aaa);
            font-family: ui-monospace, Consolas, monospace;
        }

        .wsq-folder-picker__name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .wsq-folder-picker__message {
            display: grid;
            min-height: 180px;
            place-items: center;
            padding: 24px;
            color: var(--descrip-text, #aaa);
            text-align: center;
        }

        .wsq-folder-picker__footer {
            justify-content: flex-end;
            border-top: 1px solid var(--border-color, #444);
        }

        .wsq-folder-picker__count {
            margin-right: auto;
            color: var(--descrip-text, #aaa);
            font-variant-numeric: tabular-nums;
        }

        .wsq-folder-picker__cancel,
        .wsq-folder-picker__import {
            min-height: 34px;
            padding: 6px 11px;
            border: 1px solid var(--border-color, #555);
        }

        .wsq-folder-picker__cancel {
            background: var(--comfy-input-bg, #303030);
        }

        .wsq-folder-picker__import {
            color: var(--p-button-text-color, #fff);
            background: var(--p-primary-color, #4f83d1);
        }

        .wsq-folder-picker__import:disabled {
            opacity: .42;
            cursor: default;
        }

        .wsq-folder-picker button:focus-visible {
            outline: 2px solid var(--p-primary-color, #6da7ff);
            outline-offset: 1px;
        }

        @media (prefers-reduced-motion: no-preference) {
            .wsq-folder-picker[open] {
                animation: wsq-folder-enter 160ms cubic-bezier(.23, 1, .32, 1);
            }
        }

        @keyframes wsq-folder-enter {
            from { opacity: 0; transform: scale(.97); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.append(style);
}

function 메시지_표시(container, text) {
    const message = document.createElement("div");
    message.className = "wsq-folder-picker__message";
    message.textContent = text;
    container.replaceChildren(message);
}

export function 폴더_선택기_만들기({ loadItems, importItems }) {
    스타일_설치();
    폴더_선택기_일련번호 += 1;
    const titleId = `wsq-folder-picker-title-${폴더_선택기_일련번호}`;

    const dialog = document.createElement("dialog");
    dialog.className = "wsq-folder-picker";
    dialog.setAttribute("aria-labelledby", titleId);

    const layout = document.createElement("div");
    layout.className = "wsq-folder-picker__layout";
    const header = document.createElement("header");
    header.className = "wsq-folder-picker__header";
    const title = document.createElement("h2");
    title.id = titleId;
    title.className = "wsq-folder-picker__title";
    title.textContent = "와일드카드 폴더 불러오기";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "wsq-folder-picker__close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "닫기");
    header.append(title, closeButton);

    const path = document.createElement("nav");
    path.className = "wsq-folder-picker__path";
    path.setAttribute("aria-label", "현재 와일드카드 폴더 경로");
    const list = document.createElement("div");
    list.className = "wsq-folder-picker__list";

    const footer = document.createElement("footer");
    footer.className = "wsq-folder-picker__footer";
    const count = document.createElement("span");
    count.className = "wsq-folder-picker__count";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "wsq-folder-picker__cancel";
    cancelButton.textContent = "취소";
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "wsq-folder-picker__import";
    footer.append(count, cancelButton, importButton);
    layout.append(header, path, list, footer);
    dialog.append(layout);
    document.body.append(dialog);

    let catalogItems = [];
    let currentPath = "";
    let currentFiles = [];
    let returnFocus = null;
    let openRequest = 0;

    const 경로_그리기 = () => {
        path.replaceChildren();
        const segments = currentPath ? currentPath.split("/") : [];
        const names = ["wildcards", ...segments];
        for (let index = 0; index < names.length; index += 1) {
            if (index > 0) {
                const separator = document.createElement("span");
                separator.className = "wsq-folder-picker__separator";
                separator.textContent = "/";
                separator.setAttribute("aria-hidden", "true");
                path.append(separator);
            }
            const crumb = document.createElement("button");
            crumb.type = "button";
            crumb.className = "wsq-folder-picker__crumb";
            crumb.textContent = names[index];
            const targetPath = segments.slice(0, index).join("/");
            if (index === names.length - 1) {
                crumb.setAttribute("aria-current", "page");
            }
            crumb.addEventListener("click", () => {
                currentPath = targetPath;
                그리기();
            });
            path.append(crumb);
        }
    };

    const 그리기 = () => {
        const content = 폴더_내용_만들기(catalogItems, currentPath);
        currentPath = content.currentPath;
        currentFiles = content.files;
        경로_그리기();
        list.replaceChildren();

        for (const folder of content.folders) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "wsq-folder-picker__folder";
            const icon = document.createElement("span");
            icon.textContent = "▸";
            icon.setAttribute("aria-hidden", "true");
            const name = document.createElement("span");
            name.className = "wsq-folder-picker__name";
            name.textContent = folder.name;
            const arrow = document.createElement("span");
            arrow.textContent = "›";
            arrow.setAttribute("aria-hidden", "true");
            button.append(icon, name, arrow);
            button.addEventListener("click", () => {
                currentPath = folder.path;
                그리기();
            });
            list.append(button);
        }

        for (const file of content.files) {
            const row = document.createElement("div");
            row.className = "wsq-folder-picker__file";
            const icon = document.createElement("span");
            icon.textContent = "·";
            icon.setAttribute("aria-hidden", "true");
            const name = document.createElement("span");
            name.className = "wsq-folder-picker__name";
            const tokenName = file.token.split("/").at(-1);
            name.textContent = `__${tokenName}__`;
            name.title = `__${file.token}__`;
            row.append(icon, name);
            list.append(row);
        }

        if (!content.folders.length && !content.files.length) {
            메시지_표시(list, "이 폴더에는 와일드카드 파일이 없습니다.");
        }
        count.textContent = `현재 폴더 ${content.files.length}개`;
        importButton.textContent = `현재 폴더 추가 (${content.files.length})`;
        importButton.disabled = content.files.length === 0;
    };

    const 열기 = async () => {
        openRequest += 1;
        const request = openRequest;
        returnFocus = document.activeElement;
        currentPath = "";
        catalogItems = [];
        currentFiles = [];
        count.textContent = "";
        importButton.textContent = "불러오는 중";
        importButton.disabled = true;
        path.replaceChildren();
        메시지_표시(list, "폴더 목록을 불러오는 중입니다.");
        if (!dialog.open) {
            dialog.showModal();
        }

        const items = await loadItems();
        if (request !== openRequest || !dialog.open) {
            return;
        }
        if (!items) {
            메시지_표시(list, "폴더 목록을 불러오지 못했습니다. 경로를 확인하세요.");
            importButton.textContent = "현재 폴더 추가";
            return;
        }
        catalogItems = items;
        그리기();
    };

    const 닫기 = () => dialog.close();
    closeButton.addEventListener("click", 닫기);
    cancelButton.addEventListener("click", 닫기);
    importButton.addEventListener("click", () => {
        if (!currentFiles.length) {
            return;
        }
        importItems(currentFiles, currentPath);
        닫기();
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            닫기();
        }
    });
    dialog.addEventListener("close", () => {
        openRequest += 1;
        returnFocus?.focus?.({ preventScroll: true });
    });

    return {
        open: 열기,
        destroy() {
            openRequest += 1;
            if (dialog.open) {
                dialog.close();
            }
            dialog.remove();
        },
    };
}
