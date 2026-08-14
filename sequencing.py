from __future__ import annotations

import hashlib
import random
from collections.abc import Iterable

from .models import WildcardTemplateSpec


def select_template(
    templates: Iterable[WildcardTemplateSpec], image_index: int
) -> WildcardTemplateSpec:
    ordered_templates = list(templates)
    if not ordered_templates:
        raise ValueError("Sequencer에 연결된 Wildcard Template이 없습니다.")
    if isinstance(image_index, bool) or not isinstance(image_index, int):
        raise TypeError("이미지 인덱스는 정수여야 합니다.")
    if image_index < 0:
        raise ValueError("이미지 인덱스는 0 이상이어야 합니다.")

    cycle_size = sum(template.image_count for template in ordered_templates)
    if cycle_size < 1:
        raise ValueError("템플릿 할당량의 합은 1 이상이어야 합니다.")

    position = image_index % cycle_size
    for template in ordered_templates:
        if position < template.image_count:
            return template
        position -= template.image_count

    raise RuntimeError("템플릿 순환 위치를 계산하지 못했습니다.")


def create_image_rng(seed: int, image_index: int) -> random.Random:
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise TypeError("시드는 정수여야 합니다.")
    if image_index < 0:
        raise ValueError("이미지 인덱스는 0 이상이어야 합니다.")

    digest = hashlib.sha256(f"{seed}:{image_index}".encode("utf-8")).digest()
    return random.Random(int.from_bytes(digest[:8], byteorder="big", signed=False))
