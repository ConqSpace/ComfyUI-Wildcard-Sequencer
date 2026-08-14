from __future__ import annotations

import importlib
import logging
import sys
import tempfile
import types
import unittest
from pathlib import Path


PACKAGE_ROOT = Path(__file__).parents[1]
TEST_PACKAGE_NAME = "wsq_test_package"

if TEST_PACKAGE_NAME not in sys.modules:
    package = types.ModuleType(TEST_PACKAGE_NAME)
    package.__path__ = [str(PACKAGE_ROOT)]
    sys.modules[TEST_PACKAGE_NAME] = package

engine = importlib.import_module(f"{TEST_PACKAGE_NAME}.wildcard_engine")


class ScriptedChoiceSource:
    def __init__(self, indexes: list[int]):
        self.indexes = indexes
        self.call_count = 0

    def choice(self, values: list[str]) -> str:
        index = self.indexes[self.call_count]
        self.call_count += 1
        return values[index]


class WildcardEngineTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)

    def write_wildcard(self, relative_path: str, text: str) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def test_blank_lines_and_comments_are_ignored_but_inline_hash_is_preserved(self):
        self.write_wildcard(
            "characters.txt",
            "\ufeff# 설명\n\n knight # armored \n  # 또 다른 주석\nwizard\n",
        )
        expander = engine.WildcardExpander(self.root)

        result = expander.expand("a __characters__", ScriptedChoiceSource([0]))

        self.assertEqual(result, "a knight # armored")

    def test_same_token_is_selected_independently_for_each_occurrence(self):
        self.write_wildcard("animals.txt", "cat\ndog\n")
        choice_source = ScriptedChoiceSource([0, 1])

        result = engine.WildcardExpander(self.root).expand(
            "__animals__ and __animals__", choice_source
        )

        self.assertEqual(result, "cat and dog")
        self.assertEqual(choice_source.call_count, 2)

    def test_nested_subfolder_wildcard_is_expanded(self):
        self.write_wildcard("characters.txt", "__styles/lighting__ knight\n")
        self.write_wildcard("styles/lighting.txt", "rim-lit\n")

        result = engine.WildcardExpander(self.root).expand(
            "portrait of __characters__", ScriptedChoiceSource([0, 0])
        )

        self.assertEqual(result, "portrait of rim-lit knight")

    def test_missing_and_empty_files_keep_original_token_with_warning(self):
        self.write_wildcard("empty.txt", "# no values\n\n")
        expander = engine.WildcardExpander(self.root)

        with self.assertLogs(engine.LOGGER, level=logging.WARNING):
            missing_result = expander.expand("__missing__")
        with self.assertLogs(engine.LOGGER, level=logging.WARNING):
            empty_result = expander.expand("__empty__")

        self.assertEqual(missing_result, "__missing__")
        self.assertEqual(empty_result, "__empty__")

    def test_parent_and_absolute_paths_are_rejected(self):
        expander = engine.WildcardExpander(self.root)

        with self.assertRaises(engine.WildcardPathError):
            expander.expand("__../secret__")
        with self.assertRaises(engine.WildcardPathError):
            expander.expand("__C:/secret__")

    def test_recursive_reference_is_rejected(self):
        self.write_wildcard("a.txt", "__b__\n")
        self.write_wildcard("b.txt", "__a__\n")

        with self.assertRaises(engine.WildcardRecursionError):
            engine.WildcardExpander(self.root).expand(
                "__a__", ScriptedChoiceSource([0, 0])
            )

    def test_catalog_uses_relative_tokens_and_previews(self):
        self.write_wildcard("style/lighting.txt", "rim light\nsoft light\n")

        root, items = engine.build_catalog(str(self.root))

        self.assertEqual(root, self.root.resolve())
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].token, "style/lighting")
        self.assertEqual(items[0].preview, ("rim light", "soft light"))

    def test_catalog_accepts_uppercase_txt_suffix(self):
        self.write_wildcard("style/CAMERA.TXT", "close-up\n")

        _, items = engine.build_catalog(str(self.root))

        self.assertEqual(items[0].token, "style/CAMERA")

    def test_unclosed_token_is_plain_text(self):
        result = engine.WildcardExpander(self.root).expand("portrait __characters")

        self.assertEqual(result, "portrait __characters")


if __name__ == "__main__":
    unittest.main()
