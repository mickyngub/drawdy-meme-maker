import type {
    DriverCommandIssuer,
    DriverManifest,
    DriverModule,
    ModuleStyling,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import {
    centredIn,
    findFreeRect,
    revealAndSelect,
    visibleArea,
    type Rect,
} from "./lib/free-spot";
import type {
    DriverToWebview,
    RenderedMeme,
    WebviewToDriver,
} from "./shared/messages";
import {
    UPLOAD_KEY,
    normaliseSpec,
    normaliseTemplateCache,
    type MemeSpec,
    type TemplateCache,
} from "./shared/spec";
import { WEBVIEW_HTML } from "./webview-html";

// Drawdy shows this through <img>, where currentColor is black, so the colours are explicit.
const ACTION_BUTTON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><image href="data:image/webp;base64,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" x="0" y="0" width="24" height="24"/></svg>`;

const SETTINGS_KV_KEY = "settings";
const TEMPLATES_KV_KEY = "templates";
const UPLOADS_KV_KEY = "uploads";
const MAX_UPLOADS = 30;
const MAX_SIDE_UNITS = 20000;
const UPLOAD_DATA_URL = /^data:image\/(webp|png|jpeg);base64,/;

const uploadKvKey = (key: string) => `upload:${key}`;

export const NEEDS_PERMISSION =
    "Meme Maker needs permission to read the board. Reload the page and click Allow.";
export const BOARD_FULL =
    "The board is full: it holds at most 10,000 elements. Remove some, then try again.";

const UPDATE_KEYS: SubscribeableKey[] = [
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "opacity",
    "layer",
    "frameId",
    "groupId",
    "locked",
];

type EditTarget = { id: string };

type Kept = {
    frameId?: string;
    groupId?: string;
    layer?: number;
    opacity?: number;
};

class PermissionDenied extends Error {}

let requestId = 0;
let selectionToken = 0;

let driver: {
    manifest: DriverManifest;
    issueCommand: DriverCommandIssuer;
    generateId: () => string;
    styling: ModuleStyling;
    actionButtonId: string;
    webviewId: string;
    webviewHtml: string | null;
    webviewOpen: boolean;
    panelReady: boolean;
    started: boolean;
    settings: Record<string, unknown> | null;
    templates: TemplateCache | null;
    editing: EditTarget | null;
} | null = null;

let chain: Promise<void> = Promise.resolve();

const nextRequestId = (): string => String(requestId++);

function stylingCssVars(styling: ModuleStyling): string {
    const { tokens, ...flat } = styling as ModuleStyling & {
        tokens?: Record<string, string>;
    };
    const vars = Object.entries(flat).map(([key, value]) =>
        key === "theme"
            ? `color-scheme: ${value};`
            : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`
    );
    for (const [name, value] of Object.entries(tokens ?? {})) {
        vars.push(`${name}: ${value};`);
    }
    return vars.join("");
}

function reportFailure(err: unknown): void {
    if (err instanceof PermissionDenied) {
        post({ type: "error", message: NEEDS_PERMISSION });
        return;
    }
    const detail = err instanceof Error && err.message ? err.message : "";
    post({
        type: "error",
        message: `Something went wrong${
            detail ? ` (${detail.slice(0, 80)})` : ""
        }. Try again.`,
    });
}

function enqueue(task: () => Promise<void>): Promise<void> {
    const next = chain.then(task).catch(reportFailure);
    chain = next;
    return next;
}

function post(message: DriverToWebview): void {
    if (!driver) return;
    void driver.issueCommand({
        type: "command:webview:post-message",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { webviewDomId: driver.webviewId, message },
    });
}

function placeCtx() {
    const d = driver as NonNullable<typeof driver>;
    return {
        issueCommand: d.issueCommand,
        driverId: d.manifest.driverId,
        nextRequestId,
        webviewDomId: d.webviewId,
    };
}

function denied(res: { res: { error?: { type: string } } }): boolean {
    return res.res.error?.type === "unauthorized";
}

async function history(step: "undo" | "redo"): Promise<void> {
    if (!driver) return;
    const res = await driver.issueCommand({
        type: step === "undo" ? "command:history:undo" : "command:history:redo",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
    });
    if (denied(res)) throw new PermissionDenied();
}

async function kvGet(key: string): Promise<unknown> {
    if (!driver) return undefined;
    const res = await driver.issueCommand({
        type: "command:kv-storage:get",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { key },
    });
    if (res.res.error !== undefined) return undefined;
    return res.res.value?.got?.[key];
}

async function kvSet(
    key: string,
    value: Record<string, unknown>
): Promise<void> {
    if (!driver) return;
    await driver.issueCommand({
        type: "command:kv-storage:set",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { key, payload: { [key]: value } },
    });
}

async function kvDelete(key: string): Promise<void> {
    if (!driver) return;
    await driver.issueCommand({
        type: "command:kv-storage:delete",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { key },
    });
}

export const activate: DriverModule["activate"] = async ({
    manifest,
    issueCommand,
    styling,
    generateId,
}) => {
    driver = {
        manifest,
        issueCommand,
        generateId,
        styling,
        actionButtonId: `${manifest.driverId}:action-button`,
        webviewId: `${manifest.driverId}:webview`,
        webviewHtml: null,
        webviewOpen: false,
        panelReady: false,
        started: false,
        settings: null,
        templates: null,
        editing: null,
    };
    const { driverId } = manifest;

    const created = await issueCommand({
        type: "command:dom:create-action-button",
        driverId,
        requestId: nextRequestId(),
        req: { domElementId: driver.actionButtonId, svg: ACTION_BUTTON_SVG },
    });
    if (created.res.error !== undefined) return;

    await Promise.all([
        issueCommand({
            type: "subscription:dom:element-clicked",
            driverId,
            requestId: nextRequestId(),
            req: { domElementId: driver.actionButtonId },
        }),
        issueCommand({
            type: "subscription:webview:message",
            driverId,
            requestId: nextRequestId(),
            req: { webviewDomId: driver.webviewId },
        }),
        issueCommand({
            type: "subscription:dom:theme-changed",
            driverId,
            requestId: nextRequestId(),
        }),
    ]);
};

export const onEvent: DriverModule["onEvent"] = async (event) => {
    if (!driver) return;
    switch (event.type) {
        case "subscription:dom:element-clicked": {
            if (event.body.domElementId !== driver.actionButtonId) return;
            await enqueue(openWebview);
            return;
        }
        case "subscription:webview:message": {
            if (event.body.webviewDomId !== driver.webviewId) return;
            const message = event.body.message;
            if (typeof message !== "object" || message === null) return;
            await handleWebviewMessage(message as WebviewToDriver);
            return;
        }
        case "subscription:dom:theme-changed": {
            driver.styling = event.body.styling;
            if (driver.panelReady) {
                post({
                    type: "theme",
                    cssVars: stylingCssVars(driver.styling),
                });
            }
            return;
        }
        case "subscription:scene:drawdy-element-selection": {
            if (!driver.webviewOpen || !driver.panelReady) return;
            await refreshSelection(event.body.drawdyElementIds).catch(
                reportFailure
            );
            return;
        }
        default: {
            return;
        }
    }
};

// The panel is kept alive while closed and never reloads, so a theme switch reaches it by message.
async function openWebview(): Promise<void> {
    if (!driver) return;
    if (driver.webviewHtml === null) {
        driver.webviewHtml = WEBVIEW_HTML.replace(
            "/*__DRAWDY_STYLING__*/",
            stylingCssVars(driver.styling)
        );
    }
    await driver.issueCommand({
        type: "command:webview:create",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: {
            webviewDomId: driver.webviewId,
            htmlContent: driver.webviewHtml,
            keepStateWhenClosed: true,
        },
    });
    if (!driver) return;
    driver.webviewOpen = true;
    if (driver.panelReady) {
        post({ type: "theme", cssVars: stylingCssVars(driver.styling) });
        await refreshSelection();
    }
}

async function start(): Promise<void> {
    if (!driver || driver.started) return;
    driver.started = true;
    const settings = await kvGet(SETTINGS_KV_KEY);
    if (driver && settings && typeof settings === "object") {
        driver.settings = settings as Record<string, unknown>;
    }
    const templates = normaliseTemplateCache(await kvGet(TEMPLATES_KV_KEY));
    if (driver && templates) driver.templates = templates;
    await driver?.issueCommand({
        type: "subscription:scene:drawdy-element-selection",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
    });
}

async function onReady(): Promise<void> {
    if (!driver) return;
    driver.panelReady = true;
    driver.webviewOpen = true;
    await start();
    if (!driver) return;
    post({ type: "theme", cssVars: stylingCssVars(driver.styling) });
    post({
        type: "init",
        settings: driver.settings ?? undefined,
        templates: driver.templates,
    });
    await refreshSelection();
}

async function saveSettings(settings: Record<string, unknown>): Promise<void> {
    if (!driver) return;
    driver.settings = settings;
    await kvSet(SETTINGS_KV_KEY, settings);
}

async function cacheTemplates(raw: unknown): Promise<void> {
    const templates = normaliseTemplateCache(raw);
    if (!driver || !templates) return;
    driver.templates = templates;
    await kvSet(TEMPLATES_KV_KEY, templates);
}

async function uploadKeys(): Promise<string[]> {
    const got = await kvGet(UPLOADS_KV_KEY);
    const keys =
        typeof got === "object" && got !== null
            ? (got as Record<string, unknown>).keys
            : undefined;
    return Array.isArray(keys)
        ? keys.filter((key): key is string => typeof key === "string")
        : [];
}

async function storeUpload(key: unknown, dataUrl: unknown): Promise<void> {
    if (
        typeof key !== "string" ||
        !UPLOAD_KEY.test(key) ||
        typeof dataUrl !== "string" ||
        !UPLOAD_DATA_URL.test(dataUrl)
    ) {
        return;
    }
    await kvSet(uploadKvKey(key), { dataUrl });
    const keys = (await uploadKeys()).filter((k) => k !== key);
    keys.push(key);
    const evicted = keys.splice(0, Math.max(0, keys.length - MAX_UPLOADS));
    for (const old of evicted) await kvDelete(uploadKvKey(old));
    await kvSet(UPLOADS_KV_KEY, { keys });
}

async function storedUpload(key: string): Promise<string | null> {
    const got = await kvGet(uploadKvKey(key));
    const dataUrl =
        typeof got === "object" && got !== null
            ? (got as Record<string, unknown>).dataUrl
            : undefined;
    return typeof dataUrl === "string" && UPLOAD_DATA_URL.test(dataUrl)
        ? dataUrl
        : null;
}

async function handleWebviewMessage(message: WebviewToDriver): Promise<void> {
    if (!driver) return;
    switch (message.type) {
        case "ready": {
            await enqueue(onReady);
            return;
        }
        case "settings": {
            const settings = message.settings;
            if (typeof settings !== "object" || settings === null) return;
            await enqueue(() => saveSettings(settings));
            return;
        }
        case "cache-templates": {
            const { fetchedAt, memes } = message;
            await enqueue(() => cacheTemplates({ fetchedAt, memes }));
            return;
        }
        case "store-upload": {
            const { key, dataUrl } = message;
            await enqueue(() => storeUpload(key, dataUrl));
            return;
        }
        case "place": {
            await enqueue(() => place(message));
            return;
        }
        case "update": {
            await enqueue(() => update(message));
            return;
        }
        case "edit-selected": {
            await enqueue(loadSelected);
            return;
        }
        case "stop-edit": {
            driver.editing = null;
            return;
        }
        case "undo":
        case "redo": {
            const step = message.type;
            await enqueue(() => history(step));
            return;
        }
        case "close": {
            driver.webviewOpen = false;
            await driver.issueCommand({
                type: "command:webview:hide",
                driverId: driver.manifest.driverId,
                requestId: nextRequestId(),
                req: { webviewDomId: driver.webviewId },
            });
            return;
        }
    }
}

function ownMeta(meta: unknown): Record<string, unknown> | null {
    if (!driver || typeof meta !== "object" || meta === null) return null;
    const own = (meta as Record<string, unknown>)[driver.manifest.driverId];
    if (typeof own !== "object" || own === null) return null;
    return (own as Record<string, unknown>).v === 1
        ? (own as Record<string, unknown>)
        : null;
}

async function readElements(
    ids: string[],
    properties: SubscribeableKey[]
): Promise<SubscribedDrawdyElement[]> {
    if (!driver || ids.length === 0) return [];
    const res = await driver.issueCommand({
        type: "command:scene:get-drawdy-elements",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { properties, drawdyElementIds: ids },
    });
    if (denied(res)) throw new PermissionDenied();
    if (res.res.error !== undefined) return [];
    return res.res.value.drawdyElements;
}

async function selectedIds(): Promise<string[]> {
    if (!driver) return [];
    const res = await driver.issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
    });
    if (denied(res)) throw new PermissionDenied();
    if (res.res.error !== undefined) return [];
    return res.res.value.drawdyElementIds;
}

const isMeme = (el: SubscribedDrawdyElement) =>
    el.type === "image" && ownMeta(el.meta)?.spec !== undefined;

async function refreshSelection(ids?: string[]): Promise<void> {
    const token = ++selectionToken;
    const selected = ids ?? (await selectedIds());
    const editable = (await readElements(selected, ["type", "meta"])).some(
        isMeme
    );
    if (!driver || token !== selectionToken) return;
    post({ type: "selection", editable });
}

async function loadSelected(): Promise<void> {
    if (!driver) return;
    const memes = (
        await readElements(await selectedIds(), ["type", "meta"])
    ).filter(isMeme);
    if (!driver) return;
    if (memes.length !== 1) {
        post({
            type: "error",
            message:
                memes.length === 0
                    ? "Select a meme made with Meme Maker first."
                    : "More than one meme is selected. Select just one.",
        });
        return;
    }
    const spec = normaliseSpec(ownMeta(memes[0].meta)?.spec);
    if (!spec) {
        post({
            type: "error",
            message: "That meme's saved captions could not be read.",
        });
        return;
    }
    const uploadDataUrl =
        spec.source.kind === "upload"
            ? await storedUpload(spec.source.key)
            : null;
    if (!driver) return;
    driver.editing = { id: memes[0].id };
    post({ type: "load", spec, uploadDataUrl });
}

function readMeme(message: RenderedMeme): {
    spec: MemeSpec;
    ratio: number;
} | null {
    const spec = normaliseSpec(message.spec);
    const sizeOk = (n: unknown) =>
        typeof n === "number" && n > 0 && n <= MAX_SIDE_UNITS;
    if (
        !spec ||
        typeof message.dataUrl !== "string" ||
        !/^data:image\/(webp|png);base64,/.test(message.dataUrl) ||
        !sizeOk(message.pixelWidth) ||
        !sizeOk(message.pixelHeight) ||
        !sizeOk(message.width) ||
        !sizeOk(message.height)
    ) {
        post({ type: "error", message: "That meme could not be read." });
        return null;
    }
    return { spec, ratio: message.pixelHeight / message.pixelWidth };
}

async function preferredRect(width: number, height: number): Promise<Rect> {
    const area = await visibleArea(placeCtx());
    const rect = area
        ? centredIn(area, width, height)
        : { x: 0, y: 0, width, height };
    return { ...rect, x: Math.round(rect.x), y: Math.round(rect.y) };
}

type Added = { id: string } | { error: string };

async function addMeme(
    message: RenderedMeme,
    spec: MemeSpec,
    rect: Rect,
    keep: Kept
): Promise<Added> {
    if (!driver) return { error: "" };
    const drawdyElementId = driver.generateId();
    const added = await driver.issueCommand({
        type: "command:scene:add-drawdy-elements",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: {
            elements: [
                {
                    type: "image",
                    drawdyElementId,
                    url: message.dataUrl,
                    ...rect,
                    ...keep,
                    meta: { [driver.manifest.driverId]: { v: 1, spec } },
                },
            ],
        },
    });
    if (denied(added)) throw new PermissionDenied();
    if (added.res.error !== undefined) {
        return { error: added.res.error.message ?? "" };
    }
    // Over its element limit the board adds nothing but still answers success.
    const back = await driver.issueCommand({
        type: "command:scene:element-rects",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { drawdyElementIds: [drawdyElementId] },
    });
    if (back.res.error === undefined && back.res.value.rects.length === 0) {
        return { error: BOARD_FULL };
    }
    return { id: drawdyElementId };
}

async function place(message: RenderedMeme): Promise<void> {
    const meme = readMeme(message);
    if (!driver || !meme) return;
    const preferred = await preferredRect(
        message.width,
        message.width * meme.ratio
    );
    const rect = await findFreeRect(placeCtx(), preferred);
    const added = await addMeme(message, meme.spec, rect, {});
    if (!driver) return;
    if ("error" in added) {
        post({
            type: "error",
            message:
                added.error === BOARD_FULL
                    ? BOARD_FULL
                    : "The board rejected that meme.",
        });
        return;
    }
    await revealAndSelect(placeCtx(), [added.id], rect);
    post({ type: "placed", mode: "new" });
    await refreshSelection();
}

export function keptProperties(old: SubscribedDrawdyElement): Kept {
    const keep: Kept = {};
    if (typeof old.frameId === "string") keep.frameId = old.frameId;
    if (typeof old.groupId === "string") keep.groupId = old.groupId;
    if (typeof old.layer === "number") keep.layer = old.layer;
    if (typeof old.opacity === "number") keep.opacity = old.opacity;
    return keep;
}

async function update(message: RenderedMeme): Promise<void> {
    const meme = readMeme(message);
    if (!driver || !meme) return;
    const editing = driver.editing;
    if (!editing) {
        post({
            type: "error",
            message:
                "Select a meme on the board and click Edit selected first.",
        });
        return;
    }
    const [old] = await readElements([editing.id], UPDATE_KEYS);
    if (!driver) return;
    if (
        typeof old?.x !== "number" ||
        typeof old.y !== "number" ||
        typeof old.width !== "number" ||
        !(old.width > 0)
    ) {
        driver.editing = null;
        post({ type: "edit-ended" });
        post({
            type: "error",
            message:
                "The meme you were editing is no longer on the board. Place it as a new meme.",
        });
        return;
    }
    const removed = await driver.issueCommand({
        type: "command:scene:remove-drawdy-elements",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: { drawdyElementIds: [editing.id] },
    });
    if (denied(removed)) throw new PermissionDenied();
    if (removed.res.error !== undefined) {
        post({
            type: "error",
            message: "The board would not replace that meme.",
        });
        return;
    }
    // Same top-left and width as the old meme, so one resized on the board keeps its size.
    const rect = {
        x: old.x,
        y: old.y,
        width: old.width,
        height: old.width * meme.ratio,
    };
    const added = await addMeme(message, meme.spec, rect, keptProperties(old));
    if (!driver) return;
    if ("error" in added) {
        await history("undo");
        post({
            type: "error",
            message:
                added.error === BOARD_FULL
                    ? BOARD_FULL
                    : "The board rejected the updated meme, so the old one is back.",
        });
        return;
    }
    let undoSteps = 2;
    if (old.locked === true) {
        const locked = await driver.issueCommand({
            type: "command:scene:update-drawdy-elements",
            driverId: driver.manifest.driverId,
            requestId: nextRequestId(),
            req: {
                updates: [
                    {
                        drawdyElementId: added.id,
                        properties: { locked: true },
                    },
                ],
            },
        });
        if (locked.res.error === undefined) undoSteps = 3;
    }
    driver.editing = { id: added.id };
    await revealAndSelect(placeCtx(), [added.id], rect);
    post({
        type: "placed",
        mode: "update",
        undoSteps,
        rotationReset: typeof old.rotation === "number" && old.rotation !== 0,
    });
    await refreshSelection();
}
