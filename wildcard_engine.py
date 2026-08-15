from __future__ import annotations

import logging
import os
import random
import re
import threading
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Protocol


LOGGER = logging.getLogger(__name__)
PACKAGE_ROOT = Path(__file__).resolve().parent
DEFAULT_WILDCARD_DIRECTORY = "wildcards"
TOKEN_PATTERN = re.compile(r"__([^\r\n]+?)__")
MAX_EXPANSION_DEPTH = 20
MAX_REPLACEMENTS = 1_000


class RandomChoiceSource(Protocol):
    def choice(self, values: list[str]) -> str: ...


class WildcardError(ValueError):
    """와일드카드 입력이 안전하게 처리될 수 없을 때 발생합니다."""


class WildcardPathError(WildcardError):
    """와일드카드 루트를 벗어나는 경로를 차단합니다."""


class WildcardRecursionError(WildcardError):
    """순환 참조 또는 비정상적으로 깊은 중첩을 차단합니다."""


@dataclass(frozen=True, slots=True)
class WildcardCatalogItem:
    token: str


class _WildcardFileCache:
    """야간 대량 큐에서 같은 텍스트 파일을 매번 다시 읽지 않도록 합니다."""

    _lock = threading.Lock()
    _entries: dict[Path, tuple[tuple[int, int], tuple[str, ...]]] = {}

    @classmethod
    def read_lines(cls, path: Path) -> list[str]:
        stat_result = path.stat()
        fingerprint = (stat_result.st_mtime_ns, stat_result.st_size)

        with cls._lock:
            cached = cls._entries.get(path)
            if cached is not None and cached[0] == fingerprint:
                return list(cached[1])

        text = path.read_text(encoding="utf-8-sig")
        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]

        with cls._lock:
            cls._entries[path] = (fingerprint, tuple(lines))
        return lines


def resolve_wildcard_root(directory: str) -> Path:
    raw_directory = os.path.expandvars(os.path.expanduser(directory.strip()))
    if not raw_directory:
        raw_directory = DEFAULT_WILDCARD_DIRECTORY

    requested_path = Path(raw_directory)
    if requested_path.is_absolute():
        return requested_path.resolve()

    candidates: list[Path] = []
    try:
        import folder_paths  # type: ignore[import-not-found]

        comfy_base_path = getattr(folder_paths, "base_path", None)
        if comfy_base_path:
            candidates.append(Path(comfy_base_path) / requested_path)
    except ImportError:
        pass

    candidates.extend((PACKAGE_ROOT / requested_path, Path.cwd() / requested_path))
    for candidate in candidates:
        if candidate.is_dir():
            return candidate.resolve()
    return candidates[0].resolve()


def _ensure_existing_root(root: Path) -> Path:
    resolved_root = root.resolve()
    if not resolved_root.exists():
        raise FileNotFoundError(f"와일드카드 폴더가 없습니다: {resolved_root}")
    if not resolved_root.is_dir():
        raise NotADirectoryError(f"와일드카드 경로가 폴더가 아닙니다: {resolved_root}")
    return resolved_root


def _token_relative_path(token: str) -> PurePosixPath:
    normalized = token.strip().replace("\\", "/")
    if not normalized:
        raise WildcardPathError("빈 와일드카드 토큰은 사용할 수 없습니다.")

    relative_path = PurePosixPath(normalized)
    if relative_path.is_absolute() or any(part in {"", ".", ".."} for part in relative_path.parts):
        raise WildcardPathError(f"안전하지 않은 와일드카드 경로입니다: {token}")
    if ":" in relative_path.parts[0]:
        raise WildcardPathError(f"절대 경로는 와일드카드로 사용할 수 없습니다: {token}")

    if not normalized.lower().endswith(".txt"):
        relative_path = PurePosixPath(f"{normalized}.txt")
    return relative_path


def resolve_token_path(root: Path, token: str) -> Path:
    resolved_root = _ensure_existing_root(root)
    relative_path = _token_relative_path(token)
    candidate = (resolved_root / Path(*relative_path.parts)).resolve()

    try:
        candidate.relative_to(resolved_root)
    except ValueError as error:
        raise WildcardPathError(f"와일드카드 루트를 벗어나는 경로입니다: {token}") from error
    return candidate


class WildcardExpander:
    def __init__(
        self,
        root: Path,
        *,
        max_depth: int = MAX_EXPANSION_DEPTH,
        max_replacements: int = MAX_REPLACEMENTS,
    ) -> None:
        self.root = _ensure_existing_root(root)
        self.max_depth = max_depth
        self.max_replacements = max_replacements

    def expand(self, text: str, rng: RandomChoiceSource | None = None) -> str:
        choice_source = rng if rng is not None else random.Random()
        replacement_count = [0]
        return self._expand_text(text, choice_source, (), 0, replacement_count)

    def _expand_text(
        self,
        text: str,
        rng: RandomChoiceSource,
        token_stack: tuple[str, ...],
        depth: int,
        replacement_count: list[int],
    ) -> str:
        if depth > self.max_depth:
            raise WildcardRecursionError(
                f"와일드카드 중첩 깊이가 {self.max_depth}단계를 초과했습니다."
            )

        def replace(match: re.Match[str]) -> str:
            token = match.group(1).strip()
            normalized_token = token.replace("\\", "/").removesuffix(".txt")
            if normalized_token in token_stack:
                chain = " -> ".join((*token_stack, normalized_token))
                raise WildcardRecursionError(f"와일드카드 순환 참조를 발견했습니다: {chain}")

            replacement_count[0] += 1
            if replacement_count[0] > self.max_replacements:
                raise WildcardRecursionError(
                    f"와일드카드 치환 수가 {self.max_replacements}개를 초과했습니다."
                )

            wildcard_path = resolve_token_path(self.root, token)
            if not wildcard_path.is_file():
                LOGGER.warning("와일드카드 파일이 없어 원문을 유지합니다: %s", wildcard_path)
                return match.group(0)

            choices = _WildcardFileCache.read_lines(wildcard_path)
            if not choices:
                LOGGER.warning("사용 가능한 항목이 없어 원문을 유지합니다: %s", wildcard_path)
                return match.group(0)

            selected = rng.choice(choices)
            return self._expand_text(
                selected,
                rng,
                (*token_stack, normalized_token),
                depth + 1,
                replacement_count,
            )

        return TOKEN_PATTERN.sub(replace, text)


def build_catalog(directory: str, *, max_items: int = 5_000) -> tuple[Path, list[WildcardCatalogItem]]:
    root = _ensure_existing_root(resolve_wildcard_root(directory))
    items: list[WildcardCatalogItem] = []

    text_paths = (path for path in root.rglob("*") if path.suffix.casefold() == ".txt")
    for path in sorted(text_paths, key=lambda item: item.as_posix().casefold()):
        resolved_path = path.resolve()
        try:
            relative_path = resolved_path.relative_to(root)
        except ValueError:
            # 심볼릭 링크를 이용해 루트 밖의 텍스트 파일을 읽는 일을 막습니다.
            continue
        if not resolved_path.is_file():
            continue

        token_path = relative_path.with_suffix("").as_posix()
        items.append(WildcardCatalogItem(token=token_path))
        if len(items) >= max_items:
            break

    return root, items
