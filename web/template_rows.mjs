const 토큰_패턴 = /__([^\r\n]+?)__/g;

function 토큰_정규화(value) {
    return String(value ?? "")
        .trim()
        .replaceAll("\\", "/")
        .replace(/\.txt$/i, "")
        .toLocaleLowerCase();
}

function 폴더_경로_정규화(value) {
    return String(value ?? "")
        .trim()
        .replaceAll("\\", "/")
        .replace(/^\/+|\/+$/g, "");
}

export function 폴더_내용_만들기(catalogItems, folderPath = "") {
    const currentPath = 폴더_경로_정규화(folderPath);
    const prefix = currentPath ? `${currentPath}/` : "";
    const foldersByKey = new Map();
    const files = [];

    for (const item of catalogItems) {
        const token = String(item?.token ?? "").trim().replaceAll("\\", "/");
        if (!token || !token.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
            continue;
        }

        const remainder = token.slice(prefix.length);
        if (!remainder || remainder.startsWith("/")) {
            continue;
        }
        const separatorIndex = remainder.indexOf("/");
        if (separatorIndex < 0) {
            files.push({ token });
            continue;
        }

        const name = remainder.slice(0, separatorIndex);
        const key = name.toLocaleLowerCase();
        if (!foldersByKey.has(key)) {
            foldersByKey.set(key, {
                name,
                path: prefix + name,
            });
        }
    }

    const compare = (left, right) => left.localeCompare(
        right,
        undefined,
        { numeric: true, sensitivity: "base" },
    );
    return {
        currentPath,
        folders: [...foldersByKey.values()].sort((a, b) => compare(a.name, b.name)),
        files: files.sort((a, b) => compare(a.token, b.token)),
    };
}

export function 폴더_와일드카드_추가(
    currentRows,
    catalogItems,
    createId,
    maximumCount = 256,
) {
    const rows = [...currentRows];
    const existingTokens = new Set();
    for (const row of rows) {
        const prompt = String(row?.prompt ?? "");
        for (const match of prompt.matchAll(토큰_패턴)) {
            existingTokens.add(토큰_정규화(match[1]));
        }
    }

    let added = 0;
    let skipped = 0;
    let limited = 0;
    for (const item of catalogItems) {
        const token = String(item?.token ?? "").trim();
        const normalizedToken = 토큰_정규화(token);
        if (!normalizedToken || existingTokens.has(normalizedToken)) {
            skipped += 1;
            continue;
        }
        if (rows.length >= maximumCount) {
            limited += 1;
            continue;
        }

        rows.push({
            id: createId(),
            prompt: `__${token}__, `,
            // 구버전 수량은 Sequencer가 처음 연결될 때 기본값으로 승계합니다.
            image_count: 50,
        });
        existingTokens.add(normalizedToken);
        added += 1;
    }

    return { rows, added, skipped, limited };
}
