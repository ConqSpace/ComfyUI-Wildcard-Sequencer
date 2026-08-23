from __future__ import annotations

from comfy_api.latest import io

from .models import WildcardTemplateSequenceSpec, WildcardTemplateSpec
from .sequencing import create_image_rng, select_template
from .template_serialization import (
    DEFAULT_SCHEDULE_JSON,
    DEFAULT_TEMPLATES_JSON,
    apply_template_schedule,
    parse_template_rows,
)
from .wildcard_engine import WildcardExpander, resolve_wildcard_root


WildcardTemplate = io.Custom("WILDCARD_TEMPLATE")
WildcardTemplateSequence = io.Custom("WILDCARD_TEMPLATE_SEQUENCE")


def _create_runtime_inputs() -> list[io.Input]:
    return [
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
    ]


def _expand_selected_template(
    templates: tuple[WildcardTemplateSpec, ...] | list[WildcardTemplateSpec],
    seed: int,
    queue_group: str,
    queue_index: int,
    images_per_execution: int,
) -> str:
    if images_per_execution != 1:
        raise ValueError(
            "현재 Sequencer는 실행당 이미지 1장만 정확히 셀 수 있습니다. "
            "Empty Latent Image 등의 batch_size를 1로 설정하세요."
        )

    selected_template = select_template(templates, queue_index)
    rng = create_image_rng(seed, queue_index)
    expander = WildcardExpander(resolve_wildcard_root(selected_template.wildcard_root))

    # queue_group은 선택 계산에는 섞지 않습니다. 같은 seed와 index의 결과를
    # 재현하면서도 새 Queue 작업에서 Comfy 캐시가 이전 출력을 재사용하지 않게 합니다.
    _ = queue_group
    return expander.expand(selected_template.template, rng)


class WildcardTemplateManagerNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="WSQ_WildcardTemplateManager",
            display_name="Wildcard Template Manager",
            category="Wildcard Sequencer",
            description="한 노드에서 템플릿을 추가, 삭제, 정렬하고 시퀀스로 묶습니다.",
            inputs=[
                io.String.Input(
                    "templates_json",
                    display_name="템플릿 데이터",
                    default=DEFAULT_TEMPLATES_JSON,
                    multiline=True,
                ),
                io.String.Input(
                    "wildcard_directory",
                    display_name="와일드카드 폴더",
                    default="wildcards",
                    multiline=False,
                    advanced=True,
                ),
            ],
            outputs=[WildcardTemplateSequence.Output(display_name="templates")],
            search_aliases=["wildcard manager", "와일드카드 템플릿 매니저"],
        )

    @classmethod
    def execute(
        cls,
        templates_json: str,
        wildcard_directory: str,
    ) -> io.NodeOutput:
        wildcard_root = resolve_wildcard_root(wildcard_directory)
        if not wildcard_root.is_dir():
            raise FileNotFoundError(f"와일드카드 폴더가 없습니다: {wildcard_root}")

        templates = parse_template_rows(templates_json, str(wildcard_root))
        return io.NodeOutput(WildcardTemplateSequenceSpec(templates=templates))


class WildcardSequenceRunnerNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="WSQ_WildcardSequenceRunner",
            display_name="Wildcard Sequencer",
            category="Wildcard Sequencer",
            description="Manager의 템플릿을 공통 이미지 수만큼 순서대로 순환합니다.",
            inputs=[
                WildcardTemplateSequence.Input(
                    "templates",
                    display_name="templates",
                ),
                *_create_runtime_inputs(),
                # 기존 워크플로의 위치 기반 widget 값을 밀지 않도록 항상 맨 뒤에 둡니다.
                io.String.Input(
                    "schedule_json",
                    display_name="공통 이미지 수",
                    default=DEFAULT_SCHEDULE_JSON,
                    multiline=True,
                ),
            ],
            outputs=[io.String.Output(display_name="prompt")],
            not_idempotent=True,
            search_aliases=["wildcard cycle", "와일드카드 시퀀서"],
        )

    @classmethod
    def execute(
        cls,
        templates: WildcardTemplateSequenceSpec,
        seed: int,
        queue_group: str,
        queue_index: int,
        images_per_execution: int,
        schedule_json: str,
    ) -> io.NodeOutput:
        if not isinstance(templates, WildcardTemplateSequenceSpec):
            raise TypeError("Wildcard Template Manager 출력을 연결하세요.")
        scheduled_templates = apply_template_schedule(
            templates.templates,
            schedule_json,
        )
        prompt = _expand_selected_template(
            scheduled_templates,
            seed,
            queue_group,
            queue_index,
            images_per_execution,
        )
        return io.NodeOutput(prompt)


class WildcardTemplateNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="WSQ_WildcardTemplate",
            display_name="Wildcard Template (Legacy)",
            category="Wildcard Sequencer/Legacy",
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
                    display_name="프롬프트",
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
            is_deprecated=True,
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

        # 초기 워크플로와 API 입력 형식을 유지하되 사용자에게는 숨기는 호환 필드입니다.
        _ = template_name
        specification = WildcardTemplateSpec(
            template=template,
            image_count=image_count,
            wildcard_root=str(wildcard_root),
            template_id="legacy",
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
            display_name="Wildcard Sequencer (Legacy)",
            category="Wildcard Sequencer/Legacy",
            description="연결된 템플릿을 이미지 할당량 순서대로 순환하고 와일드카드를 무작위 전개합니다.",
            inputs=[
                io.Autogrow.Input("templates", template=template_inputs),
                *_create_runtime_inputs(),
            ],
            outputs=[io.String.Output(display_name="prompt")],
            not_idempotent=True,
            search_aliases=["wildcard cycle", "와일드카드 시퀀서"],
            is_deprecated=True,
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
        ordered_templates = [
            value
            for value in templates.values()
            if isinstance(value, WildcardTemplateSpec)
        ]
        prompt = _expand_selected_template(
            ordered_templates,
            seed,
            queue_group,
            queue_index,
            images_per_execution,
        )
        return io.NodeOutput(prompt)
