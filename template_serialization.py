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
        image_count = row.get("image_count")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"{index}번째 프롬프트를 입력하세요.")
        if isinstance(image_count, bool) or not isinstance(image_count, int):
            raise ValueError(f"{index}번째 이미지 수는 정수여야 합니다.")
        if not 1 <= image_count <= MAX_IMAGE_COUNT:
            raise ValueError(
                f"{index}번째 이미지 수는 1~{MAX_IMAGE_COUNT:,} 범위여야 합니다."
            )

        # id는 UI의 안정적인 행 추적용일 뿐 실행 결과에는 영향을 주지 않습니다.
        templates.append(
            WildcardTemplateSpec(
                template=prompt,
                image_count=image_count,
                wildcard_root=wildcard_root,
            )
        )

    return tuple(templates)
