import { fontFaceCss } from "../webview/lib/font-faces";
import { ICONS, icon } from "../webview/lib/icons";
import { PANEL_CSS } from "./panel-css";

const FOCUS =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SCROLL =
    "[scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent]";
const LINK = `cursor-pointer rounded-sm text-label text-fg-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg ${FOCUS}`;
const SECONDARY = `inline-flex h-7.5 flex-none cursor-pointer items-center justify-center gap-1 rounded-lg border border-line bg-subtle px-2.5 text-label text-fg-muted transition-colors enabled:hover:bg-hover enabled:hover:text-fg enabled:active:bg-pressed disabled:cursor-not-allowed disabled:text-fg-disabled ${FOCUS}`;
const INPUT =
    "h-9 w-full rounded-xl border border-line bg-subtle px-3 text-[13px] leading-5 text-fg placeholder:text-fg-disabled transition-colors hover:bg-hover focus:border-line-strong focus:bg-active focus:outline-none focus:ring-1 focus:ring-ring";
const ACTION = `inline-flex h-9 min-w-0 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-subtle px-3 text-label-md text-fg-muted transition-colors enabled:hover:bg-hover enabled:hover:text-fg enabled:active:bg-pressed disabled:cursor-not-allowed disabled:text-fg-disabled ${FOCUS}`;
const PRIMARY =
    "data-[variant=primary]:flex-1 data-[variant=primary]:border-transparent data-[variant=primary]:bg-accent data-[variant=primary]:text-on-accent data-[variant=primary]:enabled:hover:bg-accent-hover data-[variant=primary]:enabled:hover:text-on-accent data-[variant=primary]:enabled:active:bg-accent-pressed data-[variant=primary]:disabled:bg-disabled data-[variant=primary]:disabled:text-fg-disabled data-[variant=primary]:focus-visible:ring-offset-2 data-[variant=primary]:focus-visible:ring-offset-panel";

const BODY = `
<div id="edit-banner" class="flex flex-none items-center justify-between gap-2 border-b border-divider bg-accent-subtle px-4 py-2 text-body text-fg" hidden>
    <span>Editing a meme from the board.</span>
    <button type="button" id="stop-edit" class="${LINK}">Stop editing</button>
</div>
<input type="file" id="file" accept="image/*" hidden />
<main class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4 ${SCROLL}">
    <section id="picker" class="flex min-h-0 flex-1 flex-col gap-4" aria-label="Choose a picture">
        <button type="button" id="upload" class="flex flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center transition-colors hover:bg-hover ${FOCUS}">
            ${icon(ICONS.upload, "mb-1 size-5 text-fg-subtle")}
            <span class="text-label text-fg">Upload a picture</span>
            <span class="text-body text-fg-subtle">or drop or paste one anywhere in this panel</span>
        </button>
        <button type="button" id="back" class="${LINK} self-start" hidden>Back to your meme</button>
        <div id="template-area" class="flex min-h-0 flex-1 flex-col gap-2">
            <div class="relative flex-none">
                ${icon(ICONS.search, "pointer-events-none absolute top-2.5 left-3 size-4 text-fg-subtle")}
                <input type="search" id="search" placeholder="Search templates" aria-label="Search templates" autocomplete="off" spellcheck="false" class="${INPUT} pl-9" />
            </div>
            <p id="templates-note" class="flex-none text-body text-fg-subtle" hidden></p>
            <div id="grid" class="-m-1 grid min-h-0 flex-1 grid-cols-3 content-start gap-x-2 gap-y-3 overflow-y-auto p-1 ${SCROLL}" role="group" aria-label="Meme templates"></div>
            <p id="no-match" class="flex-none text-body text-fg-subtle" hidden>No templates match that search.</p>
        </div>
    </section>
    <section id="editor" class="flex min-h-0 flex-1 flex-col gap-4" aria-label="Captions" hidden>
        <div class="flex flex-none flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
                <span id="source-name" class="min-w-0 truncate text-label text-fg-muted"></span>
                <button type="button" id="change" class="${SECONDARY}">Change picture</button>
            </div>
            <div id="stage" class="grid h-36 place-items-center overflow-hidden rounded-xl bg-section">
                <div id="frame" class="relative h-(--fh) w-(--fw)">
                    <canvas id="preview" class="block size-full" role="img" aria-label="Preview of the meme"></canvas>
                    <div id="overlays" class="absolute inset-0"></div>
                </div>
                <div id="missing" class="flex size-full flex-col items-center justify-center gap-3 px-4 text-center" hidden>
                    <span id="missing-text" class="text-body text-fg-subtle"></span>
                    <button type="button" id="choose-again" class="${SECONDARY}">Choose picture</button>
                </div>
            </div>
        </div>
        <div id="boxes" class="-m-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1 ${SCROLL}"></div>
        <div class="flex flex-none">
            <button type="button" id="add-box" class="${SECONDARY}">${icon(ICONS.add)}Add caption</button>
        </div>
    </section>
    <div id="status" role="status" aria-live="polite" class="mt-auto flex-none text-body text-fg-subtle empty:-mt-4 data-[tone=bad]:rounded-lg data-[tone=bad]:bg-danger-subtle data-[tone=bad]:px-3 data-[tone=bad]:py-2 data-[tone=bad]:text-fg"></div>
</main>
<footer class="flex flex-none items-center gap-2 border-t border-divider px-4 py-3">
    <div id="actions" class="flex min-w-0 flex-1 items-center gap-2">
        <button type="button" id="edit-selected" class="${ACTION}" hidden>Edit selected</button>
        <button type="button" id="place" class="${ACTION} ${PRIMARY}" data-variant="primary" disabled>Place on board</button>
        <button type="button" id="update" class="${ACTION} ${PRIMARY}" data-variant="primary" hidden>Update</button>
    </div>
</footer>
`;

export function shellHtml(js: string): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource-variable/google-sans-flex@5.3.2/wght.css" />
<style id="drawdy-styling">:root{/*__DRAWDY_STYLING__*/}</style>
<style>${fontFaceCss()}</style>
<style>${PANEL_CSS}</style>
</head>
<body class="flex h-screen flex-col overflow-hidden bg-panel font-sans text-body text-fg antialiased">
${BODY}
<script>${js}</script>
</body>
</html>`;
}
