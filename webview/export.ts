const MAX_SIDE = 2048;
const MAX_DATA_URL = 1_200_000;
const STEP_DOWN = 0.85;
const MAX_ATTEMPTS = 10;

export type EncodedImage = {
    dataUrl: string;
    pixelWidth: number;
    pixelHeight: number;
};

export function exportScale(width: number, height: number): number {
    return Math.min(2, MAX_SIDE / Math.max(width, height, 1));
}

/**
 * WebP for an opaque image, PNG when the background is transparent. Over 1.2 MB,
 * WebP quality drops to 0.8 then 0.7, then the image shrinks in 0.85 steps.
 */
export function encodeImage(
    width: number,
    height: number,
    transparent: boolean,
    draw: (canvas: HTMLCanvasElement, scale: number) => void,
    startScale = exportScale(width, height)
): EncodedImage {
    const canvas = document.createElement("canvas");
    const type = transparent ? "image/png" : "image/webp";
    const qualities = transparent ? [undefined] : [0.92, 0.8, 0.7];
    let scale = startScale;
    let last: EncodedImage | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        draw(canvas, scale);
        for (const quality of qualities) {
            last = {
                dataUrl: canvas.toDataURL(type, quality),
                pixelWidth: canvas.width,
                pixelHeight: canvas.height,
            };
            if (last.dataUrl.length <= MAX_DATA_URL) return last;
        }
        scale *= STEP_DOWN;
    }
    return last as EncodedImage;
}
