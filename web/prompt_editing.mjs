function 범위_제한(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export function 와일드카드_토큰_삽입(
    originalValue,
    selectionStart,
    selectionEnd,
    tokenName,
) {
    const original = String(originalValue ?? "");
    const start = 범위_제한(Number(selectionStart) || 0, 0, original.length);
    const end = 범위_제한(
        Math.max(Number(selectionEnd) || 0, start),
        start,
        original.length,
    );
    const normalizedToken = String(tokenName ?? "").trim();
    if (!normalizedToken) {
        throw new Error("빈 와일드카드 토큰은 삽입할 수 없습니다.");
    }

    /*
     * 반복 클릭으로 토큰을 나열하는 흐름이 가장 빠르도록 항상 `, `까지
     * 삽입합니다. 커서 뒤의 기존 쉼표나 공백은 흡수해 구분자가 겹치지 않게 합니다.
     */
    const insertion = `__${normalizedToken}__, `;
    const tail = original.slice(end).replace(/^,?\s*/, "");
    const value = `${original.slice(0, start)}${insertion}${tail}`;
    const cursor = start + insertion.length;

    return { value, cursor };
}
