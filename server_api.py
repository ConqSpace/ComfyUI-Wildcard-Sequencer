from __future__ import annotations

from aiohttp import web
from server import PromptServer

from .wildcard_engine import build_catalog


@PromptServer.instance.routes.get("/wildcard-sequencer/wildcards")
async def get_wildcard_catalog(request: web.Request) -> web.Response:
    directory = request.query.get("root", "wildcards")
    try:
        _root, items = build_catalog(directory)
    except (OSError, ValueError) as error:
        return web.json_response({"error": str(error), "items": []}, status=400)

    return web.json_response(
        {
            "items": [{"token": item.token} for item in items],
        }
    )
