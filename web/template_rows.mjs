const 토큰_패턴 = /__([^\r\n]+?)__/g;

function 토큰_정규화(value) {
    return String(value ?? "")
        .trim()
        .replaceAll("\\", "/")
        .replace(/\.txt$/i, "")
        .toLocaleLowerCase();
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
