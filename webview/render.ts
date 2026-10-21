import type { MemeBox } from "../src/shared/spec";
import { MEME_FONT } from "./lib/font-faces";

export const RENDER_MAX_SIDE = 1200;
const SIZE_BASE_WIDTH = 1000;
const LINE_HEIGHT = 1.15;
const STROKE_RATIO = 7;

export type Measure = (text: string) => number;

export type BoxLayout = {
    fontPx: number;
    lines: string[];
    x: number;
    y: number;
    width: number;
    lineHeight: number;
    height: number;
};

/** Greedy word wrap; a word wider than the box stays whole on its own line. */
export function wrapLines(
    text: string,
    maxWidth: number,
    measure: Measure
): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            lines.push("");
            continue;
        }
        let line = words[0];
        for (const word of words.slice(1)) {
            const next = `${line} ${word}`;
            if (measure(next) <= maxWidth) {
                line = next;
            } else {
                lines.push(line);
                line = word;
            }
        }
        lines.push(line);
    }
    return lines;
}

export function renderSize(
    width: number,
    height: number
): { width: number; height: number } {
    const scale = Math.min(1, RENDER_MAX_SIDE / Math.max(width, height, 1));
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

export function layoutBox(
    ctx: CanvasRenderingContext2D,
    box: MemeBox,
    width: number,
    height: number
): BoxLayout {
    const fontPx = (box.size * width) / SIZE_BASE_WIDTH;
    ctx.font = `${fontPx}px ${MEME_FONT}`;
    const boxWidth = box.w * width;
    const lines = wrapLines(
        box.caps ? box.text.toUpperCase() : box.text,
        boxWidth,
        (text) => ctx.measureText(text).width
    );
    const lineHeight = fontPx * LINE_HEIGHT;
    return {
        fontPx,
        lines,
        x: box.x * width,
        y: box.y * height,
        width: boxWidth,
        lineHeight,
        height: lines.length * lineHeight,
    };
}

export function renderMeme(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    boxes: MemeBox[]
): void {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.textBaseline = "top";
    for (const box of boxes) {
        if (box.text.trim() === "") continue;
        const layout = layoutBox(ctx, box, width, height);
        const anchor =
            box.align === "left"
                ? layout.x
                : box.align === "right"
                ? layout.x + layout.width
                : layout.x + layout.width / 2;
        const top = (i: number) =>
            layout.y +
            i * layout.lineHeight +
            (layout.lineHeight - layout.fontPx) / 2;
        ctx.textAlign = box.align;
        ctx.lineWidth = layout.fontPx / STROKE_RATIO;
        ctx.strokeStyle = box.outline;
        ctx.fillStyle = box.color;
        // All outlines first, so a line's outline never covers the fill of the line above.
        layout.lines.forEach((line, i) => ctx.strokeText(line, anchor, top(i)));
        layout.lines.forEach((line, i) => ctx.fillText(line, anchor, top(i)));
    }
}
