from __future__ import annotations

import json
from typing import Any

from .models import WildcardTemplateSpec


MAX_TEMPLATE_COUNT = 256
MAX_IMAGE_COUNT = 1_000_000
DEFAULT_TEMPLATES_JSON = json.dumps(
    [
        {
            "id": "default",
            "prompt": "portrait of __characters__",
            "image_count": 50,
        }
    ],
    ensure_ascii=False,
    separators=(",", ":"),
)
DEFAULT_SCHEDULE_JSON = "[]"


def parse_template_rows(
    templates_json: str,
    wildcard_root: str,
) -> tuple[WildcardTemplateSpec, ...]:
    """UI 행 배열을 검증해 실행 전용 불변 템플릿으로 변환합니다."""

    try:
        rows: Any = json.loads(templates_json)
    except (json.JSONDecodeError, TypeError) as error:
        raise ValueError("템플릿 목록 JSON이 올바르지 않습니다.") from error

    if not isinstance(rows, list):
        raise ValueError("템플릿 목록은 배열이어야 합니다.")
    if not rows:
        raise ValueError("템플릿을 하나 이상 추가해야 합니다.")
    if len(rows) > MAX_TEMPLATE_COUNT:
        raise ValueError(f"템플릿은 최대 {MAX_TEMPLATE_COUNT}개까지 추가할 수 있습니다.")

    templates: list[WildcardTemplateSpec] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"{index}번째 템플릿 형식이 올바르지 않습니다.")

        prompt = row.get("prompt")
        template_id_value = row.get("id", f"row-{index}")
        image_count = row.get("image_count")
        if not isinstance(template_id_value, str) or not template_id_value.strip():
            raise ValueError(f"{index}번째 템플릿 ID가 올바르지 않습니다.")
        template_id = template_id_value.strip()
        if any(template.template_id == template_id for template in templates):
            raise ValueError(f"중복된 템플릿 ID입니다: {template_id}")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"{index}번째 프롬프트를 입력하세요.")
        if isinstance(image_count, bool) or not isinstance(image_count, int):
            raise ValueError(f"{index}번째 이미지 수는 정수여야 합니다.")
        if not 1 <= image_count <= MAX_IMAGE_COUNT:
            raise ValueError(
                f"{index}번째 이미지 수는 1~{MAX_IMAGE_COUNT:,} 범위여야 합니다."
            )

        templates.append(
            WildcardTemplateSpec(
                template=prompt,
                image_count=image_count,
                wildcard_root=wildcard_root,
                template_id=template_id,
            )
        )

    return tuple(templates)


def apply_template_schedule(
    templates: tuple[WildcardTemplateSpec, ...],
    schedule_json: str,
) -> tuple[WildcardTemplateSpec, ...]:
    """Sequencer의 공통 수량을 모든 템플릿에 적용합니다.

    v0.4가 저장한 템플릿별 배열도 읽되 Manager 순서상 첫 번째 유효 수량을
    공통값으로 승계합니다. 빈 배열은 이전 Manager의 첫 행 수량을 사용합니다.
    """

    if not templates:
        raise ValueError("공통 수량을 적용할 템플릿이 없습니다.")

    try:
        rows: Any = json.loads(schedule_json)
    except (json.JSONDecodeError, TypeError) as error:
        raise ValueError("Sequencer 수량 JSON이 올바르지 않습니다.") from error

    if isinstance(rows, dict):
        image_count = rows.get("image_count")
        _validate_image_count(image_count, "공통")
        common_count = image_count
    elif isinstance(rows, list):
        common_count = _read_legacy_schedule_count(templates, rows)
    else:
        raise ValueError("Sequencer 수량 형식이 올바르지 않습니다.")

    return tuple(
        WildcardTemplateSpec(
            template=template.template,
            image_count=common_count,
            wildcard_root=template.wildcard_root,
            template_id=template.template_id,
        )
        for template in templates
    )


def _read_legacy_schedule_count(
    templates: tuple[WildcardTemplateSpec, ...],
    rows: list[Any],
) -> int:
    if len(rows) > MAX_TEMPLATE_COUNT:
        raise ValueError(f"수량 항목은 최대 {MAX_TEMPLATE_COUNT}개까지 저장할 수 있습니다.")

    counts_by_id: dict[str, int] = {}
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"{index}번째 수량 항목 형식이 올바르지 않습니다.")
        template_id = row.get("id")
        image_count = row.get("image_count")
        if not isinstance(template_id, str) or not template_id.strip():
            raise ValueError(f"{index}번째 수량 항목 ID가 올바르지 않습니다.")
        normalized_id = template_id.strip()
        if normalized_id in counts_by_id:
            raise ValueError(f"중복된 수량 항목 ID입니다: {normalized_id}")
        _validate_image_count(image_count, f"{index}번째")
        counts_by_id[normalized_id] = image_count

    for template in templates:
        if template.template_id in counts_by_id:
            return counts_by_id[template.template_id]
    return templates[0].image_count


def _validate_image_count(value: Any, label: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} 이미지 수는 정수여야 합니다.")
    if not 1 <= value <= MAX_IMAGE_COUNT:
        raise ValueError(
            f"{label} 이미지 수는 1~{MAX_IMAGE_COUNT:,} 범위여야 합니다."
        )
