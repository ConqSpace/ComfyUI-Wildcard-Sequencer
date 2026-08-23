function 이미지_수_정규화(value, fallback = 50) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.min(1_000_000, Math.max(1, Math.trunc(number)));
}

export function 스케줄_동기화(templateRows, scheduleValue) {
    let savedRows = [];
    try {
        const parsed = JSON.parse(String(scheduleValue ?? ""));
        if (Array.isArray(parsed)) {
            savedRows = parsed;
        }
    } catch {
        savedRows = [];
    }

    const savedCounts = new Map();
    for (const row of savedRows) {
        const id = String(row?.id ?? "").trim();
        if (id) {
            savedCounts.set(id, 이미지_수_정규화(row.image_count));
        }
    }

    return templateRows.map((row, index) => {
        const id = String(row?.id ?? `row-${index + 1}`).trim();
        const legacyCount = 이미지_수_정규화(row?.image_count);
        return {
            id,
            prompt: String(row?.prompt ?? ""),
            image_count: savedCounts.get(id) ?? legacyCount,
        };
    });
}

export function 스케줄_JSON(scheduleRows) {
    return JSON.stringify(
        scheduleRows.map((row) => ({
            id: row.id,
            image_count: 이미지_수_정규화(row.image_count),
        })),
    );
}

export { 이미지_수_정규화 };
