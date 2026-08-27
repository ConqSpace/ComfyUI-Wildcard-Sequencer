export function 와일드카드_검색(items, query) {
    const 낱말들 = String(query ?? "")
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    if (!낱말들.length) {
        return items;
    }

    return items.filter((item) => {
        const 검색_대상 = item.token.toLocaleLowerCase();
        return 낱말들.every((낱말) => 검색_대상.includes(낱말));
    });
}
