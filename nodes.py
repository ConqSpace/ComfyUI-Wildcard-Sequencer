from __future__ import annotations

from comfy_api.latest import io

from .models import WildcardTemplateSpec
from .sequencing import create_image_rng, select_template
from .wildcard_engine import WildcardExpander, resolve_wildcard_root


WildcardTemplate = io.Custom("WILDCARD_TEMPLATE")


class WildcardTemplateNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="WSQ_WildcardTemplate",
            display_name="Wildcard Template",
            category="Wildcard Sequencer",
            description="검색한 와일드카드와 일반 문장을 하나의 순차 생성 템플릿으로 묶습니다.",
            inputs=[
                io.String.Input(
                    "template_name",
                    display_name="이름",
                    default="Template",
                    multiline=False,
                ),
                io.String.Input(
                    "template",
                    display_name="프롬프트 템플릿",
                    default="portrait of __characters__",
                    multiline=True,
                ),
                io.Int.Input(
                    "image_count",
                    display_name="이미지 수",
                    default=50,
                    min=1,
                    max=1_000_000,
                    step=1,
                ),
                io.String.Input(
                    "wildcard_directory",
                    display_name="와일드카드 폴더",
                    default="wildcards",
                    multiline=False,
                    advanced=True,
                ),
            ],
            outputs=[WildcardTemplate.Output(display_name="template")],
            search_aliases=["wildcard prompt", "와일드카드 템플릿"],
        )

    @classmethod
    def execute(
        cls,
        template_name: str,
        template: str,
        image_count: int,
        wildcard_directory: str,
    ) -> io.NodeOutput:
        wildcard_root = resolve_wildcard_root(wildcard_directory)
        if not wildcard_root.is_dir():
            raise FileNotFoundError(f"와일드카드 폴더가 없습니다: {wildcard_root}")

        specification = WildcardTemplateSpec(
            name=template_name.strip(),
            template=template,
            image_count=image_count,
            wildcard_root=str(wildcard_root),
        )
        return io.NodeOutput(specification)


class WildcardSequencerNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        template_inputs = io.Autogrow.TemplatePrefix(
            input=WildcardTemplate.Input("template"),
            prefix="template",
            min=1,
            max=64,
        )
        return io.Schema(
            node_id="WSQ_WildcardSequencer",
            display_name="Wildcard Sequencer",
            category="Wildcard Sequencer",
            description="연결된 템플릿을 이미지 할당량 순서대로 순환하고 와일드카드를 무작위 전개합니다.",
            inputs=[
                io.Autogrow.Input("templates", template=template_inputs),
                io.Int.Input(
                    "seed",
                    display_name="시드",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
                    step=1,
                ),
                io.String.Input(
                    "queue_group",
                    display_name="Queue 작업 ID",
                    default="manual",
                    multiline=False,
                    advanced=True,
                    socketless=True,
                ),
                io.Int.Input(
                    "queue_index",
                    display_name="작업 내 이미지 번호",
                    default=0,
                    min=0,
                    max=2_147_483_647,
                    step=1,
                    advanced=True,
                    socketless=True,
                ),
                io.Int.Input(
                    "images_per_execution",
                    display_name="실행당 이미지 수",
                    default=1,
                    min=1,
                    max=1,
                    step=1,
                    advanced=True,
                    socketless=True,
                    tooltip="정확한 할당량을 위해 현재 버전은 latent batch_size=1만 지원합니다.",
                ),
            ],
            outputs=[io.String.Output(display_name="prompt")],
            not_idempotent=True,
            search_aliases=["wildcard cycle", "와일드카드 시퀀서"],
        )

    @classmethod
    def execute(
        cls,
        templates: io.Autogrow.Type,
        seed: int,
        queue_group: str,
        queue_index: int,
        images_per_execution: int,
    ) -> io.NodeOutput:
        if images_per_execution != 1:
            raise ValueError(
                "현재 Sequencer는 실행당 이미지 1장만 정확히 셀 수 있습니다. "
                "Empty Latent Image 등의 batch_size를 1로 설정하세요."
            )

        ordered_templates = [
            value
            for value in templates.values()
            if isinstance(value, WildcardTemplateSpec)
        ]
        selected_template = select_template(ordered_templates, queue_index)
        rng = create_image_rng(seed, queue_index)
        expander = WildcardExpander(resolve_wildcard_root(selected_template.wildcard_root))
        prompt = expander.expand(selected_template.template, rng)

        # queue_group은 선택 계산에는 섞지 않습니다. 같은 seed와 index의 결과를
        # 재현하면서도 새 Queue 작업에서 Comfy 캐시가 이전 출력을 재사용하지 않게 합니다.
        _ = queue_group
        return io.NodeOutput(prompt)
