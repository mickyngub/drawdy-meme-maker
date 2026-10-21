import assert from "node:assert/strict";
import { test } from "node:test";
import type { DriverManifest } from "@drawdy/driver-protocol";
import * as driver from "../src/index";
import { boot, fakeHost } from "./fake-host";

const manifest = {
    driverId: "mickyngub.meme-maker",
    driverName: "Meme Maker",
} as DriverManifest;

const webviewDomId = `${manifest.driverId}:webview`;

const clickActionButton = () =>
    driver.onEvent({
        type: "subscription:dom:element-clicked",
        body: { domElementId: `${manifest.driverId}:action-button` },
    } as any);

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

test("the first ready loads settings and subscribes to the selection, once", async () => {
    const host = fakeHost({ kv: { settings: { search: "drake" } } });
    const { message } = await boot(driver, host, manifest);
    await message({ type: "ready" });
    await message({ type: "ready" });
    const types = host.types();
    assert.equal(types.filter((t) => t === "command:kv-storage:get").length, 1);
    assert.equal(
        types.filter((t) => t === "subscription:scene:drawdy-element-selection")
            .length,
        1
    );
    const init = host.posted.find((m) => m.type === "init");
    assert.deepEqual(init.settings, { search: "drake" });
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
