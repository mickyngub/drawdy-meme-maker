import type { DriverToWebview, WebviewToDriver } from "../src/shared/messages";
import {
    BLACK,
    BOX_SIZE,
    MAX_BOXES,
    MAX_TEXT_LENGTH,
    UPLOAD_BOX_COUNT,
    WHITE,
    addedBox,
    cleanName,
    defaultBoxes,
    templateSource,
    type Align,
    type Ink,
    type MemeBox,
    type MemeSource,
    type MemeSpec,
    type Template,
    type TemplateCache,
} from "../src/shared/spec";
import { encodeImage } from "./export";
import { loadMemeFont, memeFontFailed } from "./fonts";
import { loadImage, readUpload } from "./images";
import { isField, keyAction } from "./lib/keys";
import { layoutBox, renderMeme, renderSize } from "./render";
import { fetchTemplates, matchesSearch } from "./templates";
import { FOCUS, button, el, makeSegmentedField, makeSlider } from "./ui";

type DrawdyWebviewApi = {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    onMessage(listener: (message: unknown) => void): () => void;
};

declare function acquireDrawdyApi(): DrawdyWebviewApi;

const SETTINGS_DEBOUNCE_MS = 400;
const REPLY_TIMEOUT_MS = 20000;
const PLACED_WIDTH = 480;
const NUDGE = 0.01;
const BIG_NUDGE = 0.05;
const MISSING_UPLOAD =
    "This meme's picture isn't saved in this browser. Drop it here, paste it or choose it again to keep editing.";
const MISSING_TEMPLATE =
    "The template's picture didn't load. Drop, paste or choose a picture to keep editing.";

const TILE = `flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-md border border-border p-1 hover:enabled:border-foreground disabled:cursor-default disabled:opacity-60 ${FOCUS}`;
const OVERLAY =
    "absolute top-(--y) left-(--x) h-(--h) w-(--w) cursor-move touch-none rounded-[2px] border border-dashed border-white/90 outline outline-black/50 data-[active=true]:border-solid data-[active=true]:border-primary focus-visible:outline-2 focus-visible:outline-primary";

const api = acquireDrawdyApi();
const byId = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

const closeButton = byId<HTMLButtonElement>("close");
const banner = byId<HTMLDivElement>("edit-banner");
const stopEditButton = byId<HTMLButtonElement>("stop-edit");
const fileInput = byId<HTMLInputElement>("file");
const picker = byId<HTMLElement>("picker");
const uploadButton = byId<HTMLButtonElement>("upload");
const backButton = byId<HTMLButtonElement>("back");
const templateArea = byId<HTMLDivElement>("template-area");
const searchInput = byId<HTMLInputElement>("search");
const templatesNote = byId<HTMLParagraphElement>("templates-note");
const grid = byId<HTMLDivElement>("grid");
const noMatch = byId<HTMLParagraphElement>("no-match");
const editor = byId<HTMLElement>("editor");
const sourceName = byId<HTMLSpanElement>("source-name");
const changeButton = byId<HTMLButtonElement>("change");
const stage = byId<HTMLDivElement>("stage");
const frame = byId<HTMLDivElement>("frame");
const preview = byId<HTMLCanvasElement>("preview");
const overlays = byId<HTMLDivElement>("overlays");
const missing = byId<HTMLDivElement>("missing");
const missingText = byId<HTMLSpanElement>("missing-text");
const chooseAgainButton = byId<HTMLButtonElement>("choose-again");
const boxList = byId<HTMLDivElement>("boxes");
const addBoxButton = byId<HTMLButtonElement>("add-box");
const statusLine = byId<HTMLDivElement>("status");
const editSelectedButton = byId<HTMLButtonElement>("edit-selected");
const placeButton = byId<HTMLButtonElement>("place");
const updateButton = byId<HTMLButtonElement>("update");

type Tile = { template: Template; node: HTMLButtonElement };

let tiles: Tile[] = [];
let shownTemplates: TemplateCache | null = null;
let source: MemeSource | null = null;
let image: HTMLImageElement | null = null;
let uploadDataUrl: string | null = null;
const storedUploads = new Set<string>();
let boxes: MemeBox[] = defaultBoxes(UPLOAD_BOX_COUNT);
let boxHeights: number[] = [];
let missingPicture = false;
let editing = false;
let busy = false;
let busyTimer = 0;
let settingsTimer = 0;
let renderFrame = 0;
let renderToken = 0;
let loadToken = 0;
let fetchToken = 0;

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function send(message: WebviewToDriver): void {
    api.postMessage(message);
}

function setStatus(text: string, tone: "" | "good" | "bad" = ""): void {
    statusLine.textContent = text;
    statusLine.dataset.tone = tone;
}

function allText(): string {
    return boxes
        .map((box) => (box.caps ? box.text.toUpperCase() : box.text))
        .join(" ");
}

function updateChrome(): void {
    const ready = image !== null && !missingPicture;
    placeButton.disabled = !ready || busy;
    updateButton.disabled = !ready || busy;
    placeButton.textContent = editing ? "Place as new" : "Place on board";
    placeButton.dataset.variant = editing ? "" : "primary";
    updateButton.hidden = !editing;
    banner.hidden = !editing;
    addBoxButton.disabled = boxes.length >= MAX_BOXES;
    backButton.hidden = source === null;
}

function showView(view: "pick" | "edit"): void {
    picker.hidden = view !== "pick";
    editor.hidden = view !== "edit";
    updateChrome();
    if (view === "edit") scheduleRender();
}

function setEditing(next: boolean): void {
    editing = next;
    updateChrome();
}

function setBusy(next: boolean): void {
    busy = next;
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = 0;
    updateChrome();
}

function awaitReply(): void {
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = setTimeout(() => {
        busyTimer = 0;
        setBusy(false);
        setStatus("Drawdy didn't answer. Try again.", "bad");
    }, REPLY_TIMEOUT_MS) as unknown as number;
}

function queueSettings(): void {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => {
        settingsTimer = 0;
        send({ type: "settings", settings: { search: searchInput.value } });
    }, SETTINGS_DEBOUNCE_MS) as unknown as number;
}

function applySearch(): void {
    let shown = 0;
    for (const tile of tiles) {
        const match = matchesSearch(tile.template, searchInput.value);
        tile.node.hidden = !match;
        if (match) shown++;
    }
    noMatch.hidden = tiles.length === 0 || shown > 0;
}

function showTemplates(cache: TemplateCache): void {
    const same =
        shownTemplates !== null &&
        JSON.stringify(shownTemplates.memes) === JSON.stringify(cache.memes);
    shownTemplates = cache;
    if (same) return;
    grid.replaceChildren();
    tiles = cache.memes.map((template) => {
        const node = el("button", TILE, grid);
        node.type = "button";
        node.title = template.name;
        const thumb = el(
            "img",
            "aspect-square w-full rounded-sm bg-surface2 object-cover",
            node
        );
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.decoding = "async";
        thumb.crossOrigin = "anonymous";
        thumb.addEventListener("error", () => {
            thumb.hidden = true;
            node.disabled = true;
        });
        thumb.src = template.url;
        el(
            "span",
            "w-full truncate text-center text-[10px]",
            node
        ).textContent = template.name;
        node.addEventListener("click", () => void pickTemplate(template));
        return { template, node };
    });
    applySearch();
}

function setNote(text: string): void {
    templatesNote.textContent = text;
    templatesNote.hidden = text === "";
}

const shortDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

async function refreshTemplates(cached: TemplateCache | null): Promise<void> {
    const token = ++fetchToken;
    templateArea.hidden = false;
    if (cached) showTemplates(cached);
    setNote(shownTemplates ? "" : "Loading templates…");
    const fresh = await fetchTemplates();
    if (token !== fetchToken) return;
    if (fresh) {
        showTemplates(fresh);
        setNote("");
        send({
            type: "cache-templates",
            fetchedAt: fresh.fetchedAt,
            memes: fresh.memes,
        });
        return;
    }
    if (shownTemplates) {
        setNote(
            `Couldn't reach imgflip, showing the list from ${shortDate(
                shownTemplates.fetchedAt
            )}.`
        );
    } else {
        templateArea.hidden = true;
    }
}

/** New default boxes for a new picture, keeping what was already typed. */
function withTexts(next: MemeBox[]): MemeBox[] {
    return next.map((box, i) =>
        boxes[i] ? { ...box, text: boxes[i].text } : box
    );
}

function useSource(
    next: MemeSource,
    img: HTMLImageElement,
    dataUrl: string | null,
    nextBoxes: MemeBox[]
): void {
    source = next;
    image = img;
    uploadDataUrl = dataUrl;
    boxes = nextBoxes;
    missingPicture = false;
    sourceName.textContent = next.name || "Your picture";
    buildBoxControls();
    showView("edit");
}

async function pickTemplate(template: Template): Promise<void> {
    const token = ++loadToken;
    setStatus("Loading the template…");
    try {
        const img = await loadImage(template.url);
        if (token !== loadToken) return;
        useSource(
            templateSource(template),
            img,
            null,
            withTexts(defaultBoxes(template.box_count))
        );
        setStatus("");
    } catch {
        if (token !== loadToken) return;
        setStatus(
            "That template's picture didn't load. Pick another one or try again.",
            "bad"
        );
    }
}

async function takeUpload(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) {
        setStatus("That file isn't a picture. Try a PNG, JPEG or WebP.", "bad");
        return;
    }
    const token = ++loadToken;
    setStatus("Reading the picture…");
    try {
        const upload = await readUpload(file);
        const img = await loadImage(upload.dataUrl);
        if (token !== loadToken) return;
        useSource(
            {
                kind: "upload",
                key: crypto.randomUUID(),
                name: cleanName(file.name) || "Pasted picture",
                width: upload.width,
                height: upload.height,
            },
            img,
            upload.dataUrl,
            missingPicture ? boxes : withTexts(defaultBoxes(UPLOAD_BOX_COUNT))
        );
        setStatus("");
    } catch {
        if (token !== loadToken) return;
        setStatus(
            "That picture couldn't be read. Try a PNG, JPEG or WebP.",
            "bad"
        );
    }
}

async function loadFromBoard(
    spec: MemeSpec,
    dataUrl: string | null
): Promise<void> {
    const token = ++loadToken;
    image = null;
    setEditing(true);
    const nextBoxes = spec.boxes.map((box) => ({ ...box }));
    const url = spec.source.kind === "imgflip" ? spec.source.url : dataUrl;
    const img = url ? await loadImage(url).catch(() => null) : null;
    if (token !== loadToken) return;
    if (img) {
        if (spec.source.kind === "upload") storedUploads.add(spec.source.key);
        useSource(spec.source, img, dataUrl, nextBoxes);
        setStatus(
            "Loaded the selected meme. Change it, then click Update on board."
        );
        return;
    }
    source = spec.source;
    image = null;
    uploadDataUrl = null;
    boxes = nextBoxes;
    missingPicture = true;
    missingText.textContent =
        spec.source.kind === "upload" ? MISSING_UPLOAD : MISSING_TEMPLATE;
    sourceName.textContent = spec.source.name || "Your picture";
    buildBoxControls();
    showView("edit");
    setStatus("Loaded the captions of the selected meme.");
}

function setBox(i: number, patch: Partial<MemeBox>): void {
    if (!boxes[i]) return;
    boxes[i] = { ...boxes[i], ...patch };
    scheduleRender();
}

function moveBox(i: number, x: number, y: number): void {
    const box = boxes[i];
    if (!box) return;
    const maxY = Math.max(0, 1 - (boxHeights[i] ?? 0));
    setBox(i, { x: clamp(x, 0, 1 - box.w), y: clamp(y, 0, maxY) });
}

function setActive(i: number): void {
    Array.from(overlays.children).forEach((node, j) => {
        (node as HTMLElement).dataset.active = String(i === j);
    });
}

function startDrag(event: PointerEvent, i: number, node: HTMLElement): void {
    if (event.button !== 0 || !boxes[i]) return;
    event.preventDefault();
    node.focus();
    node.setPointerCapture(event.pointerId);
    const rect = frame.getBoundingClientRect();
    const from = { x: event.clientX, y: event.clientY, box: boxes[i] };
    const move = (e: PointerEvent) =>
        moveBox(
            i,
            from.box.x + (e.clientX - from.x) / rect.width,
            from.box.y + (e.clientY - from.y) / rect.height
        );
    const end = () => {
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", end);
        node.removeEventListener("pointercancel", end);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
}

function nudge(event: KeyboardEvent, i: number): void {
    const box = boxes[i];
    if (!box) return;
    const step = event.shiftKey ? BIG_NUDGE : NUDGE;
    const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
    };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    moveBox(i, box.x + d[0], box.y + d[1]);
}

function buildOverlay(i: number): void {
    const node = el("button", OVERLAY, overlays);
    node.type = "button";
    node.setAttribute(
        "aria-label",
        `Move caption ${i + 1}. Drag it, or use the arrow keys.`
    );
    node.addEventListener("pointerdown", (event) => startDrag(event, i, node));
    node.addEventListener("keydown", (event) => nudge(event, i));
    node.addEventListener("focus", () => setActive(i));
    node.addEventListener("blur", () => setActive(-1));
}

function buildBoxControl(i: number): void {
    const box = boxes[i];
    const n = i + 1;
    const card = el(
        "div",
        "flex flex-none flex-col gap-1.5 rounded-md border border-border p-2",
        boxList
    );
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", `Caption ${n}`);
    const head = el("div", "flex items-center justify-between gap-2", card);
    el(
        "span",
        "text-[10px] font-medium tracking-[0.02em] text-muted-foreground",
        head
    ).textContent = `Caption ${n}`;
    const remove = button(
        head,
        "cursor-pointer rounded-sm px-1 py-px text-[10px] text-muted-foreground hover:enabled:text-destructive disabled:cursor-default disabled:opacity-40",
        "Remove",
        () => removeBox(i),
        `Remove caption ${n}`
    );
    remove.disabled = boxes.length <= 1;
    const text = el(
        "textarea",
        `min-h-11 w-full resize-none rounded-sm border border-border bg-background px-1.5 py-1 text-xs focus:border-primary focus:outline-none`,
        card
    );
    text.rows = 2;
    text.maxLength = MAX_TEXT_LENGTH;
    text.placeholder = "Type a caption";
    text.value = box.text;
    text.setAttribute("aria-label", `Caption ${n} text`);
    text.addEventListener("input", () => setBox(i, { text: text.value }));
    text.addEventListener("focus", () => setActive(i));
    text.addEventListener("blur", () => setActive(-1));
    makeSlider(
        card,
        { label: "Size", ...BOX_SIZE, step: 1, unit: "" },
        box.size,
        (size) => setBox(i, { size })
    );
    const row = el("div", "grid grid-cols-[auto_1fr] gap-2", card);
    makeSegmentedField<Ink>(
        row,
        "Colour",
        [
            [WHITE, "White"],
            [BLACK, "Black"],
        ],
        box.color,
        (color) =>
            setBox(i, { color, outline: color === WHITE ? BLACK : WHITE })
    );
    makeSegmentedField<Align>(
        row,
        "Align",
        [
            ["left", "Left"],
            ["center", "Centre"],
            ["right", "Right"],
        ],
        box.align,
        (align) => setBox(i, { align })
    );
}

function buildBoxControls(): void {
    boxList.replaceChildren();
    overlays.replaceChildren();
    boxes.forEach((_, i) => {
        buildBoxControl(i);
        buildOverlay(i);
    });
    updateChrome();
    scheduleRender();
}

function removeBox(i: number): void {
    if (boxes.length <= 1) return;
    boxes = boxes.filter((_, j) => j !== i);
    buildBoxControls();
}

function addBox(): void {
    if (boxes.length >= MAX_BOXES) return;
    boxes = [...boxes, addedBox()];
    buildBoxControls();
    boxList.querySelectorAll("textarea")[boxes.length - 1]?.focus();
}

function scheduleRender(): void {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        void render();
    });
}

async function render(): Promise<void> {
    const token = ++renderToken;
    missing.hidden = !missingPicture;
    frame.hidden = missingPicture || image === null;
    if (editor.hidden || !image || missingPicture) return;
    await loadMemeFont(allText());
    if (token !== renderToken || !image) return;
    paintPreview(image);
}

function paintPreview(img: HTMLImageElement): void {
    const roomW = stage.clientWidth;
    const roomH = stage.clientHeight;
    if (roomW <= 0 || roomH <= 0) return;
    const fit = Math.min(roomW / img.naturalWidth, roomH / img.naturalHeight);
    const cssW = Math.max(1, Math.round(img.naturalWidth * fit));
    const cssH = Math.max(1, Math.round(img.naturalHeight * fit));
    frame.style.setProperty("--fw", `${cssW}px`);
    frame.style.setProperty("--fh", `${cssH}px`);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (preview.width !== w) preview.width = w;
    if (preview.height !== h) preview.height = h;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    renderMeme(ctx, img, boxes);
    boxHeights = boxes.map((box) => layoutBox(ctx, box, w, h).height / h);
    Array.from(overlays.children).forEach((node, i) => {
        const box = boxes[i];
        if (!box) return;
        const style = (node as HTMLElement).style;
        style.setProperty("--x", `${box.x * 100}%`);
        style.setProperty("--y", `${box.y * 100}%`);
        style.setProperty("--w", `${box.w * 100}%`);
        style.setProperty("--h", `${boxHeights[i] * 100}%`);
    });
}

async function sendMeme(mode: "place" | "update"): Promise<void> {
    const img = image;
    const src = source;
    if (busy || !img || !src || missingPicture) return;
    setBusy(true);
    setStatus(mode === "update" ? "Updating…" : "Placing…");
    try {
        await loadMemeFont(allText());
        const snapshot = boxes.map((box) => ({ ...box }));
        const size = renderSize(img.naturalWidth, img.naturalHeight);
        const encoded = encodeImage(
            size.width,
            size.height,
            false,
            (canvas) => {
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("No canvas.");
                renderMeme(ctx, img, snapshot);
            },
            1
        );
        if (
            src.kind === "upload" &&
            uploadDataUrl &&
            !storedUploads.has(src.key)
        ) {
            send({
                type: "store-upload",
                key: src.key,
                dataUrl: uploadDataUrl,
            });
            storedUploads.add(src.key);
        }
        const spec: MemeSpec = { source: src, boxes: snapshot };
        send({
            type: mode,
            ...encoded,
            width: PLACED_WIDTH,
            height: (PLACED_WIDTH * encoded.pixelHeight) / encoded.pixelWidth,
            spec,
        });
        awaitReply();
    } catch {
        setBusy(false);
        setStatus("The meme could not be drawn. Try again.", "bad");
    }
}

function imageFile(files: FileList | undefined | null): File | null {
    return (
        Array.from(files ?? []).find((file) =>
            file.type.startsWith("image/")
        ) ?? null
    );
}

function wire(): void {
    closeButton.addEventListener("click", () => send({ type: "close" }));
    uploadButton.addEventListener("click", () => fileInput.click());
    chooseAgainButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        fileInput.value = "";
        if (file) void takeUpload(file);
    });
    searchInput.addEventListener("input", () => {
        applySearch();
        queueSettings();
    });
    changeButton.addEventListener("click", () => showView("pick"));
    backButton.addEventListener("click", () => showView("edit"));
    addBoxButton.addEventListener("click", addBox);
    placeButton.addEventListener("click", () => void sendMeme("place"));
    updateButton.addEventListener("click", () => void sendMeme("update"));
    editSelectedButton.addEventListener("click", () => {
        setStatus("Reading the selected meme…");
        send({ type: "edit-selected" });
    });
    stopEditButton.addEventListener("click", () => {
        setEditing(false);
        send({ type: "stop-edit" });
        setStatus("Stopped editing. Place on board adds a new meme.");
    });
    document.addEventListener("dragover", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    });
    document.addEventListener("drop", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        const file = imageFile(event.dataTransfer.files);
        if (file) void takeUpload(file);
        else
            setStatus(
                "That file isn't a picture. Try a PNG, JPEG or WebP.",
                "bad"
            );
    });
    document.addEventListener("paste", (event) => {
        const file = imageFile(event.clipboardData?.files);
        if (!file) return;
        event.preventDefault();
        void takeUpload(file);
    });
    document.addEventListener("keydown", (event) => {
        const action = keyAction(event, isField(event.target));
        if (!action) return;
        event.preventDefault();
        if (action === "blur") (event.target as HTMLElement).blur();
        else send({ type: action });
    });
    window.addEventListener("resize", scheduleRender);
}

function placedText(
    message: Extract<DriverToWebview, { type: "placed" }>
): string {
    if (message.mode === "new") {
        return "Placed the meme. Press ⌘Z or Ctrl+Z to undo.";
    }
    const times =
        message.undoSteps === 2 ? "twice" : `${message.undoSteps} times`;
    return `Updated the meme${
        message.rotationReset ? " (rotation reset)" : ""
    }. Press ⌘Z or Ctrl+Z ${times} to get the old version back.`;
}

function handle(message: DriverToWebview): void {
    switch (message.type) {
        case "init": {
            const search = message.settings?.search;
            if (typeof search === "string") searchInput.value = search;
            void refreshTemplates(message.templates ?? null);
            return;
        }
        case "theme": {
            const node = document.getElementById("drawdy-styling");
            if (node) node.textContent = `:root{${message.cssVars}}`;
            return;
        }
        case "selection": {
            editSelectedButton.hidden = !message.editable;
            return;
        }
        case "load": {
            void loadFromBoard(message.spec, message.uploadDataUrl);
            return;
        }
        case "edit-ended": {
            setEditing(false);
            return;
        }
        case "placed": {
            setBusy(false);
            const fallback = memeFontFailed()
                ? " Anton didn't load, so it used a system font."
                : "";
            setStatus(placedText(message) + fallback, fallback ? "" : "good");
            return;
        }
        case "error": {
            setBusy(false);
            setStatus(message.message, "bad");
            return;
        }
    }
}

wire();
showView("pick");

api.onMessage((raw) => {
    if (!raw || typeof raw !== "object") return;
    handle(raw as DriverToWebview);
});

send({ type: "ready" });
