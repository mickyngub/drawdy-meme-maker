import type {
    DriverCommandIssuer,
    DriverManifest,
    DriverModule,
    ModuleStyling,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import type { DriverToWebview, WebviewToDriver } from "./shared/messages";
import { WEBVIEW_HTML } from "./webview-html";

// Drawdy shows this through <img>, where currentColor is black, so the colours are explicit.
const ACTION_BUTTON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="6" fill="url(#g)"/><rect x="5" y="5" width="14" height="2.8" rx="1.4" fill="#ffffff"/><rect x="7" y="16.2" width="10" height="2.8" rx="1.4" fill="#ffffff"/><circle cx="9.5" cy="12" r="1.2" fill="#ffffff"/><circle cx="14.5" cy="12" r="1.2" fill="#ffffff"/></svg>`;

const SETTINGS_KV_KEY = "settings";

export const NEEDS_PERMISSION =
    "Meme Maker needs permission to read the board. Reload the page and click Allow.";

class PermissionDenied extends Error {}

let requestId = 0;
let selectionToken = 0;

let driver: {
    manifest: DriverManifest;
    issueCommand: DriverCommandIssuer;
    styling: ModuleStyling;
    actionButtonId: string;
    webviewId: string;
    webviewHtml: string | null;
    webviewOpen: boolean;
    panelReady: boolean;
    started: boolean;
    settings: Record<string, unknown> | null;
} | null = null;

let chain: Promise<void> = Promise.resolve();

const nextRequestId = (): string => String(requestId++);

function stylingCssVars(styling: ModuleStyling): string {
    return Object.entries(styling)
        .map(([key, value]) =>
            key === "theme"
                ? `color-scheme: ${value};`
                : `--drawdy-${key.replace(
                      /[A-Z]/g,
                      (c) => `-${c.toLowerCase()}`
                  )}: ${value};`
        )
        .join("");
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

export const activate: DriverModule["activate"] = async ({
    manifest,
    issueCommand,
    styling,
}) => {
    driver = {
        manifest,
        issueCommand,
        styling,
        actionButtonId: `${manifest.driverId}:action-button`,
        webviewId: `${manifest.driverId}:webview`,
        webviewHtml: null,
        webviewOpen: false,
        panelReady: false,
        started: false,
        settings: null,
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
    const { driverId } = driver.manifest;
    const stored = await driver.issueCommand({
        type: "command:kv-storage:get",
        driverId,
        requestId: nextRequestId(),
        req: { key: SETTINGS_KV_KEY },
    });
    if (driver && stored.res.error === undefined) {
        const restored = stored.res.value?.got?.[SETTINGS_KV_KEY];
        if (restored && typeof restored === "object") {
            driver.settings = restored as Record<string, unknown>;
        }
    }
    await driver?.issueCommand({
        type: "subscription:scene:drawdy-element-selection",
        driverId,
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
    post({ type: "init", settings: driver.settings ?? undefined });
    await refreshSelection();
}

async function saveSettings(settings: Record<string, unknown>): Promise<void> {
    if (!driver) return;
    driver.settings = settings;
    await driver.issueCommand({
        type: "command:kv-storage:set",
        driverId: driver.manifest.driverId,
        requestId: nextRequestId(),
        req: {
            key: SETTINGS_KV_KEY,
            payload: { [SETTINGS_KV_KEY]: settings },
        },
    });
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
