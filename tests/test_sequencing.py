from __future__ import annotations

import importlib
import random
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
sequencing = importlib.import_module(f"{TEST_PACKAGE_NAME}.sequencing")
WildcardTemplateSpec = models.WildcardTemplateSpec


def make_template(name: str, count: int) -> WildcardTemplateSpec:
    return WildcardTemplateSpec(
        template=f"__{name.lower()}__",
        image_count=count,
        wildcard_root="wildcards",
    )


class WildcardTemplateSpecTests(unittest.TestCase):
    def test_valid_specification_is_immutable(self):
        specification = make_template("A", 50)

        with self.assertRaises((AttributeError, TypeError)):
            specification.image_count = 10

    def test_empty_template_and_invalid_count_are_rejected(self):
        with self.assertRaises(ValueError):
            WildcardTemplateSpec("   ", 1, "wildcards")
        with self.assertRaises(ValueError):
            WildcardTemplateSpec("text", 0, "wildcards")
        with self.assertRaises(TypeError):
            WildcardTemplateSpec("text", True, "wildcards")


class SequencingTests(unittest.TestCase):
    def setUp(self):
        self.templates = [
            make_template("A", 50),
            make_template("B", 50),
            make_template("C", 50),
        ]

    def test_quota_boundaries_and_cycle(self):
        expected_templates = {
            0: "__a__",
            49: "__a__",
            50: "__b__",
            99: "__b__",
            100: "__c__",
            149: "__c__",
            150: "__a__",
            199: "__a__",
        }

        for image_index, expected_template in expected_templates.items():
            with self.subTest(image_index=image_index):
                selected = sequencing.select_template(self.templates, image_index)
                self.assertEqual(selected.template, expected_template)

    def test_two_hundred_images_allocate_expected_counts(self):
        selected_templates = [
            sequencing.select_template(self.templates, image_index).template
            for image_index in range(200)
        ]

        self.assertEqual(selected_templates.count("__a__"), 100)
        self.assertEqual(selected_templates.count("__b__"), 50)
        self.assertEqual(selected_templates.count("__c__"), 50)

    def test_disconnected_middle_template_is_naturally_compressed(self):
        remaining_templates = [self.templates[0], self.templates[2]]

        self.assertEqual(
            sequencing.select_template(remaining_templates, 49).template, "__a__"
        )
        self.assertEqual(
            sequencing.select_template(remaining_templates, 50).template, "__c__"
        )
        self.assertEqual(
            sequencing.select_template(remaining_templates, 100).template, "__a__"
        )

    def test_empty_templates_and_negative_index_are_rejected(self):
        with self.assertRaises(ValueError):
            sequencing.select_template([], 0)
        with self.assertRaises(ValueError):
            sequencing.select_template(self.templates, -1)

    def test_image_rng_is_repeatable_and_does_not_touch_global_random(self):
        global_state = random.getstate()

        first = sequencing.create_image_rng(1234, 77).random()
        second = sequencing.create_image_rng(1234, 77).random()

        self.assertEqual(first, second)
        self.assertEqual(random.getstate(), global_state)


if __name__ == "__main__":
    unittest.main()
