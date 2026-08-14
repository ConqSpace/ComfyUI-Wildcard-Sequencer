from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class WildcardTemplateSpec:
    """Template 노드와 Sequencer 노드 사이에서만 전달되는 불변 데이터입니다."""

    name: str
    template: str
    image_count: int
    wildcard_root: str

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("템플릿 이름은 비워둘 수 없습니다.")
        if not self.template.strip():
            raise ValueError("프롬프트 템플릿은 비워둘 수 없습니다.")
        if isinstance(self.image_count, bool) or not isinstance(self.image_count, int):
            raise TypeError("이미지 수량은 정수여야 합니다.")
        if self.image_count < 1:
            raise ValueError("이미지 수량은 1 이상이어야 합니다.")
        if not self.wildcard_root.strip():
            raise ValueError("와일드카드 폴더를 지정해야 합니다.")
