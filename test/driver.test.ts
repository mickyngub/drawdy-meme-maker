import assert from "node:assert/strict";
import { test } from "node:test";
import type { DriverManifest } from "@drawdy/driver-protocol";
import * as driver from "../src/index";
import { overlaps } from "../src/lib/free-spot";
import { defaultBoxes, type MemeSpec, type Template } from "../src/shared/spec";
import { boot, fakeHost } from "./fake-host";

const manifest = {
    driverId: "mickyngub.meme-maker",
    driverName: "Meme Maker",
} as DriverManifest;

const webviewDomId = `${manifest.driverId}:webview`;

const spec: MemeSpec = {
    source: {
        kind: "imgflip",
        id: "181913649",
        name: "Drake Hotline Bling",
        url: "https://i.imgflip.com/30b1gx.jpg",
        width: 1200,
        height: 1200,
    },
    boxes: defaultBoxes(2).map((box, i) => ({
        ...box,
        text: i === 0 ? "writing tests" : "shipping on friday",
    })),
};

const meme = {
    dataUrl: "data:image/webp;base64,AAAA",
    pixelWidth: 1200,
    pixelHeight: 1200,
    width: 480,
    height: 480,
    spec,
};

const uploadSpec: MemeSpec = {
    source: {
        kind: "upload",
        key: "3f2b6c1e-8d4a-4b7e-9c2d-5a6b7c8d9e0f",
        name: "cat.png",
        width: 800,
        height: 600,
    },
    boxes: defaultBoxes(2),
};

const template: Template = {
    id: "181913649",
    name: "Drake Hotline Bling",
    url: "https://i.imgflip.com/30b1gx.jpg",
    width: 1200,
    height: 1200,
    box_count: 2,
};

const own = (meta: unknown) =>
    (meta as Record<string, { spec: MemeSpec }>)[manifest.driverId];

const clickActionButton = () =>
    driver.onEvent({
        type: "subscription:dom:element-clicked",
        body: { domElementId: `${manifest.driverId}:action-button` },
    } as any);

function putMeme(host: ReturnType<typeof fakeHost>, memeSpec: MemeSpec) {
    host.put({
        drawdyElementId: "old",
        type: "image",
        x: 0,
        y: 0,
        width: 480,
        height: 360,
        meta: { [manifest.driverId]: { v: 1, spec: memeSpec } },
    });
    host.select(["old"]);
}

test("activate touches only the dom permission", async () => {
    const host = fakeHost();
    await boot(driver, host, manifest);
    const types = host.types();
    assert.ok(types.includes("command:dom:create-action-button"));
    for (const type of types) {
        assert.match(type, /^(command|subscription):(dom|webview):/);
    }
});

test("the action button opens the panel, kept alive when closed and styled for the board", async () => {
    const host = fakeHost();
    await boot(driver, host, manifest);
    await clickActionButton();
    const create = host.sent.find((s) => s.type === "command:webview:create");
    assert.ok(create);
    assert.equal(create.req.webviewDomId, webviewDomId);
    assert.equal(create.req.keepStateWhenClosed, true);
    assert.ok(!create.req.htmlContent.includes("/*__DRAWDY_STYLING__*/"));
    assert.ok(create.req.htmlContent.includes("color-scheme: light;"));
});

test("close hides the panel", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    host.clear();
    await message({ type: "close" });
    const hide = host.sent.find((s) => s.type === "command:webview:hide");
    assert.ok(hide);
    assert.equal(hide.req.webviewDomId, webviewDomId);
});

test("only the first ready reads storage and subscribes to the selection", async () => {
    const host = fakeHost({ kv: { settings: { search: "drake" } } });
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    const reads = host.types().filter((t) => t === "command:kv-storage:get");
    await message({ type: "ready" });
    const types = host.types();
    assert.equal(
        types.filter((t) => t === "command:kv-storage:get").length,
        reads.length
    );
    assert.equal(
        types.filter((t) => t === "subscription:scene:drawdy-element-selection")
            .length,
        1
    );
    const init = host.posted.find((m) => m.type === "init");
    assert.deepEqual(init.settings, { search: "drake" });
    assert.equal(init.templates, null);
});

test("a theme change reaches the open panel", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    host.clear();
    await driver.onEvent({
        type: "subscription:dom:theme-changed",
        body: { styling: { theme: "dark", primary: "#818cf8" } },
    } as any);
    assert.deepEqual(host.posted, [
        {
            type: "theme",
            cssVars: "color-scheme: dark;--drawdy-primary: #818cf8;",
        },
    ]);
});

test("selection events are ignored while the panel is closed", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    await message({ type: "close" });
    host.clear();
    await driver.onEvent({
        type: "subscription:scene:drawdy-element-selection",
        body: { drawdyElementIds: ["x"] },
    } as any);
    assert.equal(host.sent.length, 0);
});

test("a denied board read on ready ends in the permission message, not a hang", async () => {
    const host = fakeHost({ denied: ["command:scene"] });
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    assert.deepEqual(host.posted.at(-1), {
        type: "error",
        message: driver.NEEDS_PERMISSION,
    });
});

test("undo and redo from the panel go to the board history", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "undo" });
    await message({ type: "redo" });
    const types = host.types();
    assert.ok(types.includes("command:history:undo"));
    assert.ok(types.includes("command:history:redo"));
});

test("place stores the spec on a 480 unit wide image", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    await message({ type: "place", ...meme });
    const [placed] = [...host.elements.values()];
    assert.equal(placed.type, "image");
    assert.equal(placed.url, meme.dataUrl);
    assert.equal(placed.width, 480);
    assert.equal(placed.height, 480);
    assert.deepEqual(own(placed.meta), { v: 1, spec });
    assert.deepEqual(host.posted.at(-2), { type: "placed", mode: "new" });
});

test("a second place lands beside the first, and each result is selected", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    await message({ type: "place", ...meme });
    await message({ type: "place", ...meme });
    const placed = [...host.elements.values()];
    assert.equal(placed.length, 2);
    const [a, b] = placed.map((el) => ({
        x: el.x as number,
        y: el.y as number,
        width: el.width as number,
        height: el.height as number,
    }));
    assert.equal(overlaps(a, b), false);
    const selections = host.sent.filter(
        (s) => s.type === "command:scene:set-selection"
    );
    assert.deepEqual(
        selections.map((s) => s.req.drawdyElementIds),
        placed.map((el) => [el.drawdyElementId])
    );
});

test("a full board is reported instead of a silent success", async () => {
    const host = fakeHost({ full: true });
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    await message({ type: "place", ...meme });
    assert.deepEqual(host.posted.at(-1), {
        type: "error",
        message: driver.BOARD_FULL,
    });
});

test("update re-reads the meme and keeps its spot, width, layer, group, frame, opacity and lock", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    host.put({
        drawdyElementId: "old",
        type: "image",
        x: 120,
        y: -80,
        width: 300,
        height: 300,
        rotation: 0.3,
        opacity: 0.5,
        layer: 4,
        frameId: "frame-1",
        groupId: "group-1",
        locked: false,
        meta: { [manifest.driverId]: { v: 1, spec } },
    });
    host.select(["old"]);
    await message({ type: "edit-selected" });
    // Moved and locked after Edit selected: the update must use the new values.
    host.put({ ...host.elements.get("old")!, x: 500, locked: true });
    const edited: MemeSpec = {
        ...spec,
        boxes: spec.boxes.map((box) => ({ ...box, text: "edited" })),
    };
    await message({ type: "update", ...meme, spec: edited });

    assert.equal(host.elements.has("old"), false);
    const [fresh] = [...host.elements.values()];
    assert.equal(fresh.x, 500);
    assert.equal(fresh.y, -80);
    assert.equal(fresh.width, 300);
    assert.equal(fresh.height, 300);
    assert.equal(fresh.layer, 4);
    assert.equal(fresh.frameId, "frame-1");
    assert.equal(fresh.groupId, "group-1");
    assert.equal(fresh.opacity, 0.5);
    assert.equal(fresh.locked, true);
    assert.deepEqual(own(fresh.meta).spec, edited);
    assert.deepEqual(
        host.types().filter((t) => /remove-drawdy|add-drawdy/.test(t)),
        [
            "command:scene:remove-drawdy-elements",
            "command:scene:add-drawdy-elements",
        ]
    );
    assert.deepEqual(host.posted.at(-2), {
        type: "placed",
        mode: "update",
        undoSteps: 3,
        rotationReset: true,
    });
});

test("a failed add after the remove is undone, so the old meme comes back", async () => {
    const host = fakeHost({ failAdd: true });
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    putMeme(host, spec);
    await message({ type: "edit-selected" });
    await message({ type: "update", ...meme });
    assert.ok(host.types().includes("command:history:undo"));
    assert.ok(host.elements.has("old"));
    assert.equal(host.posted.at(-1).type, "error");
});

test("a 31st stored upload evicts the oldest, keeping 30", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    const keys = Array.from({ length: 31 }, (_, i) => `upload-${i}`);
    for (const key of keys) {
        await message({
            type: "store-upload",
            key,
            dataUrl: `data:image/webp;base64,${key}`,
        });
    }
    assert.deepEqual(host.kv.uploads, { keys: keys.slice(1) });
    assert.equal(host.kv["upload:upload-0"], undefined);
    assert.ok(
        host.sent.some(
            (s) =>
                s.type === "command:kv-storage:delete" &&
                s.req.key === "upload:upload-0"
        )
    );
    assert.deepEqual(host.kv["upload:upload-30"], {
        dataUrl: "data:image/webp;base64,upload-30",
    });
});

test("editing a meme whose upload is not in this browser loads it without the picture", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    putMeme(host, uploadSpec);
    await message({ type: "edit-selected" });
    assert.deepEqual(host.posted.at(-1), {
        type: "load",
        spec: uploadSpec,
        uploadDataUrl: null,
    });
});

test("editing a meme whose upload is stored sends the picture with it", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    const dataUrl = "data:image/webp;base64,CAT";
    if (uploadSpec.source.kind !== "upload") throw new Error("upload spec");
    await message({
        type: "store-upload",
        key: uploadSpec.source.key,
        dataUrl,
    });
    putMeme(host, uploadSpec);
    await message({ type: "edit-selected" });
    assert.deepEqual(host.posted.at(-1), {
        type: "load",
        spec: uploadSpec,
        uploadDataUrl: dataUrl,
    });
});

test("templates the panel caches come back in init on the next ready", async () => {
    const host = fakeHost();
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    await message({
        type: "cache-templates",
        fetchedAt: 1761091200000,
        memes: [template],
    });
    await message({ type: "ready" });
    const cache = { fetchedAt: 1761091200000, memes: [template] };
    const inits = host.posted.filter((m) => m.type === "init");
    assert.equal(inits[0].templates, null);
    assert.deepEqual(inits.at(-1).templates, cache);
    assert.deepEqual(host.kv.templates, cache);
});

test("templates cached in an earlier session arrive with the first init", async () => {
    const cache = { fetchedAt: 1761091200000, memes: [template] };
    const host = fakeHost({ kv: { templates: cache } });
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    const init = host.posted.find((m) => m.type === "init");
    assert.deepEqual(init.templates, cache);
});
