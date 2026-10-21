import {
    MAX_TEMPLATES,
    normaliseTemplate,
    type Template,
    type TemplateCache,
} from "../src/shared/spec";

const API = "https://api.imgflip.com/get_memes";
const TIMEOUT_MS = 10000;

export async function fetchTemplates(): Promise<TemplateCache | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(API, { signal: controller.signal });
        if (!res.ok) return null;
        const body = (await res.json()) as {
            success?: unknown;
            data?: { memes?: unknown };
        };
        if (body?.success !== true || !Array.isArray(body.data?.memes)) {
            return null;
        }
        const memes = body.data.memes
            .map(normaliseTemplate)
            .filter((meme): meme is Template => meme !== null)
            .slice(0, MAX_TEMPLATES);
        return memes.length > 0 ? { fetchedAt: Date.now(), memes } : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export function matchesSearch(template: Template, query: string): boolean {
    const q = query.trim().toLowerCase();
    return q === "" || template.name.toLowerCase().includes(q);
}
