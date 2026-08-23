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
apply_template_schedule = serialization.apply_template_schedule
apply_common_image_count = serialization.apply_common_image_count


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
            [template.template_id for template in templates],
            ["a", "b", "c"],
        )
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
        self.assertEqual(templates[0].template_id, "row-1")

    def test_시퀀서_공통_수량을_모든_템플릿에_적용한다(self) -> None:
        templates = parse_template_rows(
            json.dumps(
                [
                    {"id": "a", "prompt": "A", "image_count": 20},
                    {"id": "b", "prompt": "B", "image_count": 30},
                ]
            ),
            "wildcards",
        )

        scheduled = apply_common_image_count(templates, 70)

        self.assertEqual(
            [(template.template_id, template.image_count) for template in scheduled],
            [("a", 70), ("b", 70)],
        )

    def test_v04_수량표는_Manager_첫_행의_수량을_공통값으로_승계한다(self) -> None:
        templates = parse_template_rows(
            '[{"id":"a","prompt":"A","image_count":20},'
            '{"id":"b","prompt":"B","image_count":30}]',
            "wildcards",
        )

        scheduled = apply_template_schedule(
            templates,
            '[{"id":"b","image_count":70},{"id":"a","image_count":40}]',
        )

        self.assertEqual(
            [template.image_count for template in scheduled],
            [40, 40],
        )

    def test_빈_스케줄은_Manager의_기존_수량을_승계한다(self) -> None:
        templates = parse_template_rows(
            '[{"id":"a","prompt":"A","image_count":35}]',
            "wildcards",
        )

        scheduled = apply_template_schedule(templates, "[]")

        self.assertEqual([template.image_count for template in scheduled], [35])

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

    def test_중복된_템플릿_ID와_수량_ID를_거부한다(self) -> None:
        duplicate_templates = json.dumps(
            [
                {"id": "same", "prompt": "A", "image_count": 1},
                {"id": "same", "prompt": "B", "image_count": 1},
            ]
        )
        with self.assertRaises(ValueError):
            parse_template_rows(duplicate_templates, "wildcards")

        templates = parse_template_rows(
            '[{"id":"a","prompt":"A","image_count":1}]',
            "wildcards",
        )
        with self.assertRaises(ValueError):
            apply_template_schedule(
                templates,
                '[{"id":"a","image_count":1},{"id":"a","image_count":2}]',
            )

    def test_잘못된_스케줄_형식을_거부한다(self) -> None:
        templates = parse_template_rows(
            '[{"id":"a","prompt":"A","image_count":1}]',
            "wildcards",
        )
        invalid_values = (
            "{}",
            "{",
            '"50"',
            "null",
            '[{"id":"","image_count":1}]',
            '[{"id":"a","image_count":0}]',
            '[{"id":"a","image_count":"50"}]',
            '{"image_count":0}',
            '{"image_count":"50"}',
        )
        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    apply_template_schedule(templates, value)
        for count in (True, 0, -1, 1.5, "50", 1_000_001):
            with self.subTest(common_count=count):
                with self.assertRaises(ValueError):
                    apply_common_image_count(templates, count)

    def test_빈_시퀀스를_거부한다(self) -> None:
        with self.assertRaises(ValueError):
            WildcardTemplateSequenceSpec(templates=())
        with self.assertRaises(ValueError):
            apply_template_schedule((), '{"image_count":50}')
        with self.assertRaises(ValueError):
            apply_common_image_count((), 50)


if __name__ == "__main__":
    unittest.main()
