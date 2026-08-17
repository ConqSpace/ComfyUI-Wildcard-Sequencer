import assert from "node:assert/strict";

import { 와일드카드_토큰_삽입 } from "../web/prompt_editing.mjs";


const empty = 와일드카드_토큰_삽입("", 0, 0, "characters");
assert.deepEqual(empty, {
    value: "__characters__, ",
    cursor: "__characters__, ".length,
});

const repeated = 와일드카드_토큰_삽입(
    "__characters__, ",
    "__characters__, ".length,
    "__characters__, ".length,
    "lighting",
);
assert.equal(repeated.value, "__characters__, __lighting__, ");

const existingSeparator = 와일드카드_토큰_삽입(
    "portrait,   cinematic",
    0,
    "portrait".length,
    "style",
);
assert.equal(existingSeparator.value, "__style__, cinematic");

const middleInsertion = 와일드카드_토큰_삽입(
    "portrait subject",
    "portrait".length,
    "portrait".length,
    "style",
);
assert.equal(middleInsertion.value, "portrait__style__, subject");

assert.throws(
    () => 와일드카드_토큰_삽입("", 0, 0, "   "),
    /빈 와일드카드 토큰/,
);

console.log("prompt editing tests: OK");
