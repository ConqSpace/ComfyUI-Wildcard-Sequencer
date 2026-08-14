from __future__ import annotations

from comfy_api.latest import ComfyExtension, io

from .nodes import WildcardSequencerNode, WildcardTemplateNode
from . import server_api as _server_api


WEB_DIRECTORY = "./web"


class WildcardSequencerExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [WildcardTemplateNode, WildcardSequencerNode]


async def comfy_entrypoint() -> WildcardSequencerExtension:
    return WildcardSequencerExtension()


__all__ = ["WEB_DIRECTORY", "comfy_entrypoint"]
