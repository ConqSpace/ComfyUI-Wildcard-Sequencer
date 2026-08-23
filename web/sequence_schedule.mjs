export function 이미지_수_정규화(value, fallback = 50) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.min(1_000_000, Math.max(1, Math.trunc(number)));
}

export function 회전_합계_문구(templateCount, imageCount) {
    const normalizedTemplateCount = Math.max(
        0,
        Math.trunc(Number(templateCount) || 0),
    );
    const normalizedImageCount = 이미지_수_정규화(imageCount);
    const total = normalizedTemplateCount * normalizedImageCount;
    return `${normalizedTemplateCount}개 × ${normalizedImageCount.toLocaleString()}장 = ${total.toLocaleString()}장`;
}

export function 공통_수량_읽기(templateRows, scheduleValue) {
    let savedValue = null;
    try {
        savedValue = JSON.parse(String(scheduleValue ?? ""));
    } catch {
        savedValue = null;
    }

    if (savedValue && !Array.isArray(savedValue) && typeof savedValue === "object") {
        return 이미지_수_정규화(savedValue.image_count);
    }

    if (Array.isArray(savedValue)) {
        const countsById = new Map();
        for (const row of savedValue) {
            const id = String(row?.id ?? "").trim();
            if (id) {
                countsById.set(id, 이미지_수_정규화(row.image_count));
            }
        }
        for (const row of templateRows) {
            const id = String(row?.id ?? "").trim();
            if (countsById.has(id)) {
                return countsById.get(id);
            }
        }
    }

    return 이미지_수_정규화(templateRows[0]?.image_count);
}

export function 이전_공통_수량_읽기(templateRows, scheduleValue) {
    let savedValue = null;
    try {
        savedValue = JSON.parse(String(scheduleValue ?? ""));
    } catch {
        return null;
    }

    if (savedValue && !Array.isArray(savedValue) && typeof savedValue === "object") {
        return 이미지_수_정규화(savedValue.image_count);
    }
    if (Array.isArray(savedValue) && templateRows.length > 0) {
        return 공통_수량_읽기(templateRows, scheduleValue);
    }
    return null;
}
