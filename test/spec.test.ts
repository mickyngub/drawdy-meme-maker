import assert from "node:assert/strict";
import { test } from "node:test";
import {
    BLACK,
    MAX_BOXES,
    WHITE,
    defaultBoxes,
    normaliseSpec,
} from "../src/shared/spec";

function assertClose(actual: number[], expected: number[]): void {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, i) =>
        assert.ok(
            Math.abs(value - expected[i]) < 1e-9,
            `${value} is not ${expected[i]}`
        )
    );
}

const ys = (count: number) => defaultBoxes(count).map((box) => box.y);

const source = {
    kind: "imgflip",
    id: "181913649",
    name: "Drake Hotline Bling",
    url: "https://i.imgflip.com/30b1gx.jpg",
    width: 1200,
    height: 1200,
};

test("one default box sits at the bottom, two at the top and the bottom", () => {
    assertClose(ys(1), [0.8]);
    assertClose(ys(2), [0.04, 0.8]);
});

test("three or more default boxes spread down the image", () => {
    assertClose(ys(3), [0.05, 0.35, 0.65]);
});

test("a template asking for seven boxes gets six", () => {
    assert.equal(defaultBoxes(7).length, MAX_BOXES);
    assertClose(
        ys(7),
        Array.from({ length: MAX_BOXES }, (_, i) => 0.05 + i * 0.15)
    );
});

test("default boxes are wide, white with a black outline, centred and in capitals", () => {
    for (const box of defaultBoxes(3)) {
        assert.deepEqual(
            { ...box, y: 0 },
            {
                text: "",
                x: 0.05,
                y: 0,
                w: 0.9,
                size: 64,
                color: WHITE,
                outline: BLACK,
                align: "center",
                caps: true,
            }
        );
    }
});

test("normaliseSpec clamps the size and keeps every box inside the image", () => {
    const spec = normaliseSpec({
        source,
        boxes: [
            { text: "big", x: -1, y: 2, w: 5, size: 999 },
            { text: "small", x: 0.5, y: 0.5, w: 0.8, size: 3 },
        ],
    });
    assert.ok(spec);
    const [a, b] = spec.boxes;
    assert.deepEqual([a.x, a.y, a.w, a.size], [0, 1, 1, 160]);
    assert.equal(b.size, 24);
    assertClose([b.x + b.w], [1]);
});

test("normaliseSpec keeps between one and six boxes", () => {
    const many = normaliseSpec({
        source,
        boxes: Array.from({ length: 9 }, () => ({ text: "x" })),
    });
    assert.equal(many?.boxes.length, MAX_BOXES);
    assert.equal(normaliseSpec({ source, boxes: [] })?.boxes.length, 1);
});

test("normaliseSpec refuses a picture it would not load", () => {
    assert.equal(
        normaliseSpec({
            source: { ...source, url: "https://example.com/x.jpg" },
            boxes: [],
        }),
        null
    );
    assert.equal(
        normaliseSpec({
            source: { kind: "upload", key: "../x", width: 10, height: 10 },
            boxes: [],
        }),
        null
    );
});
