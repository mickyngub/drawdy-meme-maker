import { MEME_FAMILY } from "./lib/font-faces";

const TIMEOUT_MS = 8000;
const SAMPLE_LIMIT = 2000;

let failed = false;
let loadedSample: string | null = null;

export async function loadMemeFont(text: string): Promise<boolean> {
    if (typeof document === "undefined" || !document.fonts) return false;
    const sample = `A${text.slice(0, SAMPLE_LIMIT)}`;
    if (sample === loadedSample) return true;
    const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS)
    );
    try {
        const faces = await Promise.race([
            document.fonts.load(`64px "${MEME_FAMILY}"`, sample),
            timeout,
        ]);
        const ok =
            faces !== null && faces.some((face) => face.status === "loaded");
        failed = !ok;
        loadedSample = ok ? sample : null;
        return ok;
    } catch {
        failed = true;
        return false;
    }
}

export const memeFontFailed = (): boolean => failed;
