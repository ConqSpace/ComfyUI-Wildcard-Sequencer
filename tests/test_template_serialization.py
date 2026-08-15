from __future__ import annotations

import json
import importlib
import sys
import types
import unittest
from pathlib import Path


PACKAGE_ROOT = Path(__file__).parents[1]
TEST_PACKAGE_NAME = "wsq_test_package"

if TEST_PACKAGE_NAME not in sys.modules:
    package = types.ModuleType(TEST_PACKAGE_NAME)
    package.__path__ = [str(PACKAGE_ROOT)]
    sys.modules[TEST_PACKAGE_NAME] = package

models = importlib.import_module(f"{TEST_PACKAGE_NAME}.models")
serialization = importlib.import_module(
    f"{TEST_PACKAGE_NAME}.template_serialization"
)
WildcardTemplateSequenceSpec = models.WildcardTemplateSequenceSpec
MAX_TEMPLATE_COUNT = serialization.MAX_TEMPLATE_COUNT
parse_template_rows = serialization.parse_template_rows


class TemplateSerializationTests(unittest.TestCase):
    def test_행_순서와_중복을_그대로_유지한다(self) -> None:
        rows = [
            {"id": "a", "prompt": "__person__", "image_count": 2},
            {"id": "b", "prompt": "__person__", "image_count": 3},
            {"id": "c", "prompt": "photo of __place__", "image_count": 4},
        ]

        templates = parse_template_rows(json.dumps(rows), "C:/wildcards")

        self.assertEqual(
            [template.template for template in templates],
            ["__person__", "__person__", "photo of __place__"],
        )
        self.assertEqual(
            [template.image_count for template in templates],
            [2, 3, 4],
        )
        self.assertEqual(templates[0].wildcard_root, "C:/wildcards")
        self.assertEqual(
            WildcardTemplateSequenceSpec(templates=templates).templates,
            templates,
        )

    def test_식별자는_실행_데이터에_필수가_아니다(self) -> None:
        templates = parse_template_rows(
            '[{"prompt":"plain prompt","image_count":1}]',
            "wildcards",
        )

        self.assertEqual(templates[0].template, "plain prompt")

    def test_잘못된_json과_배열이_아닌_값을_거부한다(self) -> None:
        for value in ("{", "{}", '"row"', "null"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_template_rows(value, "wildcards")

    def test_빈_목록과_빈_프롬프트를_거부한다(self) -> None:
        invalid_values = (
            "[]",
            '[{"prompt":"","image_count":1}]',
            '[{"prompt":"   ","image_count":1}]',
        )
        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_template_rows(value, "wildcards")

    def test_이미지_수_범위를_검증한다(self) -> None:
        invalid_counts = (True, 0, -1, 1.5, "50", 1_000_001)
        for count in invalid_counts:
            with self.subTest(count=count):
                value = json.dumps([{"prompt": "x", "image_count": count}])
                with self.assertRaises(ValueError):
                    parse_template_rows(value, "wildcards")

    def test_최대_템플릿_수를_검증한다(self) -> None:
        rows = [
            {"prompt": f"row {index}", "image_count": 1}
            for index in range(MAX_TEMPLATE_COUNT + 1)
        ]

        with self.assertRaises(ValueError):
            parse_template_rows(json.dumps(rows), "wildcards")

    def test_빈_시퀀스를_거부한다(self) -> None:
        with self.assertRaises(ValueError):
            WildcardTemplateSequenceSpec(templates=())


if __name__ == "__main__":
    unittest.main()
