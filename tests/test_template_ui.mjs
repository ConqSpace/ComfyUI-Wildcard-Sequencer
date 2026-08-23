import assert from "node:assert/strict";

import { 스케줄_JSON, 스케줄_동기화 } from "../web/sequence_schedule.mjs";
import { 폴더_와일드카드_추가 } from "../web/template_rows.mjs";


let nextId = 0;
const imported = 폴더_와일드카드_추가(
    [{ id: "a", prompt: "portrait of __characters__", image_count: 20 }],
    [
        { token: "characters" },
        { token: "styles/lighting" },
        { token: "camera/angle" },
    ],
    () => `new-${++nextId}`,
);
assert.equal(imported.added, 2);
assert.equal(imported.skipped, 1);
assert.deepEqual(
    imported.rows.map((row) => row.prompt),
    [
        "portrait of __characters__",
        "__styles/lighting__, ",
        "__camera/angle__, ",
    ],
);

const repeatedImport = 폴더_와일드카드_추가(
    imported.rows,
    [{ token: "styles\\lighting.txt" }],
    () => "unused",
);
assert.equal(repeatedImport.added, 0);
assert.equal(repeatedImport.skipped, 1);

const schedule = 스케줄_동기화(
    [
        { id: "a", prompt: "A", image_count: 20 },
        { id: "b", prompt: "B", image_count: 30 },
    ],
    '[{"id":"b","image_count":70},{"id":"deleted","image_count":9}]',
);
assert.deepEqual(
    schedule.map((row) => [row.id, row.image_count]),
    [["a", 20], ["b", 70]],
);
assert.equal(
    스케줄_JSON(schedule),
    '[{"id":"a","image_count":20},{"id":"b","image_count":70}]',
);

console.log("template UI tests: OK");
