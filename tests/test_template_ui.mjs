import assert from "node:assert/strict";

import {
    공통_수량_읽기,
    이전_공통_수량_읽기,
    적재량_문구,
} from "../web/sequence_schedule.mjs";
import {
    폴더_내용_만들기,
    폴더_와일드카드_추가,
} from "../web/template_rows.mjs";


let nextId = 0;
const catalog = [
    { token: "characters" },
    { token: "styles/lighting" },
    { token: "styles/camera/angle" },
];
const rootContent = 폴더_내용_만들기(catalog);
assert.deepEqual(rootContent.folders, [{ name: "styles", path: "styles" }]);
assert.deepEqual(rootContent.files, [{ token: "characters" }]);

const stylesContent = 폴더_내용_만들기(catalog, "styles");
assert.deepEqual(stylesContent.folders, [
    { name: "camera", path: "styles/camera" },
]);
assert.deepEqual(stylesContent.files, [{ token: "styles/lighting" }]);

const imported = 폴더_와일드카드_추가(
    [{ id: "a", prompt: "portrait of __characters__", image_count: 20 }],
    stylesContent.files,
    () => `new-${++nextId}`,
);
assert.equal(imported.added, 1);
assert.equal(imported.skipped, 0);
assert.deepEqual(
    imported.rows.map((row) => row.prompt),
    [
        "portrait of __characters__",
        "__styles/lighting__, ",
    ],
);

const repeatedImport = 폴더_와일드카드_추가(
    imported.rows,
    [{ token: "styles\\lighting.txt" }],
    () => "unused",
);
assert.equal(repeatedImport.added, 0);
assert.equal(repeatedImport.skipped, 1);

const templates = [
    { id: "a", prompt: "A", image_count: 20 },
    { id: "b", prompt: "B", image_count: 30 },
];
assert.equal(공통_수량_읽기(templates, '{"image_count":80}'), 80);
assert.equal(
    공통_수량_읽기(
        templates,
        '[{"id":"b","image_count":70},{"id":"a","image_count":40}]',
    ),
    40,
);
assert.equal(공통_수량_읽기(templates, "[]"), 20);
assert.equal(이전_공통_수량_읽기([], '{"image_count":80}'), 80);
assert.equal(
    이전_공통_수량_읽기(
        templates,
        '[{"id":"b","image_count":70},{"id":"a","image_count":40}]',
    ),
    40,
);
assert.equal(이전_공통_수량_읽기([], "[]"), null);
assert.equal(적재량_문구(3, 50), "150");
assert.equal(적재량_문구(0, 50), "0");

console.log("template UI tests: OK");
