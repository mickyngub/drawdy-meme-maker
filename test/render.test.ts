import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSize, wrapLines } from "../webview/render";

const measure = (text: string) => text.length * 10;

test("words wrap at the box width", () => {
    assert.deepEqual(wrapLines("one does not simply", 100, measure), [
        "one does",
        "not simply",
    ]);
});

test("a word wider than the box stays whole on its own line", () => {
    assert.deepEqual(wrapLines("a supercalifragilistic b", 50, measure), [
        "a",
        "supercalifragilistic",
        "b",
    ]);
});

test("line breaks typed into a caption are kept", () => {
    assert.deepEqual(wrapLines("top\nbottom", 1000, measure), [
        "top",
        "bottom",
    ]);
});

test("the picture renders at its own size, capped at 1200 px on the long side", () => {
    assert.deepEqual(renderSize(800, 600), { width: 800, height: 600 });
    assert.deepEqual(renderSize(2400, 1200), { width: 1200, height: 600 });
});
