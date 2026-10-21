export const MAX_BOXES = 6;
export const UPLOAD_BOX_COUNT = 2;
export const BOX_SIZE = { min: 24, max: 160 };
export const MAX_TEXT_LENGTH = 300;
export const MAX_NAME_LENGTH = 100;
export const MAX_TEMPLATES = 100;
const MIN_BOX_WIDTH = 0.1;
const MAX_SIDE = 20000;

export const WHITE = "#ffffff";
export const BLACK = "#000000";
export type Ink = typeof WHITE | typeof BLACK;
const INKS: readonly Ink[] = [WHITE, BLACK];

export const ALIGNS = ["left", "center", "right"] as const;
export type Align = typeof ALIGNS[number];

export type MemeSource =
    | {
          kind: "imgflip";
          id: string;
          name: string;
          url: string;
          width: number;
          height: number;
      }
    | {
          kind: "upload";
          key: string;
          name: string;
          width: number;
          height: number;
      };

/** x, y and w are fractions of the image; size is in px at a 1000 px wide image. */
export type MemeBox = {
    text: string;
    x: number;
    y: number;
    w: number;
    size: number;
    color: Ink;
    outline: Ink;
    align: Align;
    caps: boolean;
};

export type MemeSpec = { source: MemeSource; boxes: MemeBox[] };

export type Template = {
    id: string;
    name: string;
    url: string;
    width: number;
    height: number;
    box_count: number;
};

export type TemplateCache = { fetchedAt: number; memes: Template[] };

const IMGFLIP_URL = /^https:\/\/i\.imgflip\.com\/[A-Za-z0-9._/-]+$/;
const TEMPLATE_ID = /^[A-Za-z0-9_-]{1,32}$/;
export const UPLOAD_KEY = /^[A-Za-z0-9-]{1,64}$/;

const BOX: MemeBox = {
    text: "",
    x: 0.05,
    y: 0.8,
    w: 0.9,
    size: 64,
    color: WHITE,
    outline: BLACK,
    align: "center",
    caps: true,
};

export function defaultBoxes(boxCount: number): MemeBox[] {
    const n = Number.isFinite(boxCount)
        ? Math.min(MAX_BOXES, Math.max(1, Math.round(boxCount)))
        : 1;
    const ys =
        n === 1
            ? [0.8]
            : n === 2
            ? [0.04, 0.8]
            : Array.from({ length: n }, (_, i) => 0.05 + (i * 0.9) / n);
    return ys.map((y) => ({ ...BOX, y }));
}

/** A box added in the panel starts in the middle, so it doesn't land on a default one. */
export const addedBox = (): MemeBox => ({ ...BOX, y: 0.45 });

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const num = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

const side = (value: unknown): number | null =>
    typeof value === "number" && value > 0 && value <= MAX_SIDE ? value : null;

function oneOf<T>(list: readonly T[], value: unknown, fallback: T): T {
    return list.includes(value as T) ? (value as T) : fallback;
}

export const cleanName = (value: unknown): string =>
    typeof value === "string"
        ? value
              .replace(/[\r\n\t]+/g, " ")
              .trim()
              .slice(0, MAX_NAME_LENGTH)
        : "";

function normaliseSource(raw: unknown): MemeSource | null {
    if (typeof raw !== "object" || raw === null) return null;
    const got = raw as Record<string, unknown>;
    const width = side(got.width);
    const height = side(got.height);
    if (width === null || height === null) return null;
    const name = cleanName(got.name);
    if (got.kind === "imgflip") {
        if (typeof got.id !== "string" || !TEMPLATE_ID.test(got.id))
            return null;
        if (typeof got.url !== "string" || !IMGFLIP_URL.test(got.url)) {
            return null;
        }
        return {
            kind: "imgflip",
            id: got.id,
            name,
            url: got.url,
            width,
            height,
        };
    }
    if (got.kind === "upload") {
        if (typeof got.key !== "string" || !UPLOAD_KEY.test(got.key)) {
            return null;
        }
        return { kind: "upload", key: got.key, name, width, height };
    }
    return null;
}

export function normaliseBox(raw: unknown): MemeBox | null {
    if (typeof raw !== "object" || raw === null) return null;
    const got = raw as Record<string, unknown>;
    const w = clamp(num(got.w, BOX.w), MIN_BOX_WIDTH, 1);
    return {
        text:
            typeof got.text === "string"
                ? got.text.replace(/\r\n?/g, "\n").slice(0, MAX_TEXT_LENGTH)
                : "",
        x: clamp(num(got.x, BOX.x), 0, 1 - w),
        y: clamp(num(got.y, BOX.y), 0, 1),
        w,
        size: Math.round(
            clamp(num(got.size, BOX.size), BOX_SIZE.min, BOX_SIZE.max)
        ),
        color: oneOf(INKS, got.color, BOX.color),
        outline: oneOf(INKS, got.outline, BOX.outline),
        align: oneOf(ALIGNS, got.align, BOX.align),
        caps: typeof got.caps === "boolean" ? got.caps : BOX.caps,
    };
}

export function normaliseSpec(raw: unknown): MemeSpec | null {
    if (typeof raw !== "object" || raw === null) return null;
    const got = raw as Record<string, unknown>;
    const source = normaliseSource(got.source);
    if (!source) return null;
    const boxes = (Array.isArray(got.boxes) ? got.boxes : [])
        .map(normaliseBox)
        .filter((box): box is MemeBox => box !== null)
        .slice(0, MAX_BOXES);
    return { source, boxes: boxes.length > 0 ? boxes : defaultBoxes(1) };
}

export function normaliseTemplate(raw: unknown): Template | null {
    if (typeof raw !== "object" || raw === null) return null;
    const got = raw as Record<string, unknown>;
    const width = side(got.width);
    const height = side(got.height);
    const name = cleanName(got.name);
    if (
        typeof got.id !== "string" ||
        !TEMPLATE_ID.test(got.id) ||
        typeof got.url !== "string" ||
        !IMGFLIP_URL.test(got.url) ||
        name === "" ||
        width === null ||
        height === null
    ) {
        return null;
    }
    return {
        id: got.id,
        name,
        url: got.url,
        width,
        height,
        box_count: Math.round(clamp(num(got.box_count, 2), 1, MAX_BOXES)),
    };
}

export function normaliseTemplateCache(raw: unknown): TemplateCache | null {
    if (typeof raw !== "object" || raw === null) return null;
    const got = raw as Record<string, unknown>;
    if (typeof got.fetchedAt !== "number" || !Number.isFinite(got.fetchedAt)) {
        return null;
    }
    const memes = (Array.isArray(got.memes) ? got.memes : [])
        .map(normaliseTemplate)
        .filter((meme): meme is Template => meme !== null)
        .slice(0, MAX_TEMPLATES);
    return memes.length > 0 ? { fetchedAt: got.fetchedAt, memes } : null;
}

export const templateSource = (t: Template): MemeSource => ({
    kind: "imgflip",
    id: t.id,
    name: t.name,
    url: t.url,
    width: t.width,
    height: t.height,
});
