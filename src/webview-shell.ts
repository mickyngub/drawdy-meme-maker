import { fontFaceCss } from "../webview/lib/font-faces";
import { PANEL_CSS } from "./panel-css";

const FOCUS =
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";
const BTN = `flex-none cursor-pointer rounded-sm border border-border px-[11px] py-[5px] text-[11px] hover:enabled:border-foreground disabled:cursor-default disabled:opacity-40 ${FOCUS}`;
const PRIMARY =
    "data-[variant=primary]:border-primary data-[variant=primary]:bg-primary data-[variant=primary]:text-primary-foreground";
const SMALL_BTN = `flex-none cursor-pointer rounded-sm border border-border px-[7px] py-px text-[10px] hover:border-foreground ${FOCUS}`;
const LINK = `cursor-pointer py-0.5 text-[11px] underline ${FOCUS}`;

const BODY = `
<header class="flex flex-none items-center justify-between gap-2 border-b border-border px-3 py-2">
    <h1 class="text-[13px] font-semibold">Meme Maker</h1>
    <button type="button" id="close" class="cursor-pointer rounded-sm border border-border px-2.5 py-1 text-[11px] hover:border-foreground ${FOCUS}">Close</button>
</header>
<div id="edit-banner" class="flex flex-none items-center justify-between gap-2 border-b border-border bg-primary/12 px-3 py-1.5 text-[11px]" hidden>
    <span>Editing a meme from the board.</span>
    <button type="button" id="stop-edit" class="${LINK}">Stop editing</button>
</div>
<input type="file" id="file" accept="image/*" hidden />
<section id="picker" class="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2.5 pb-2" aria-label="Choose a picture">
    <button type="button" id="upload" class="flex flex-none cursor-pointer flex-col items-center gap-0.5 rounded-md border border-dashed border-border px-3 py-3 hover:border-foreground ${FOCUS}">
        <span class="text-xs font-medium">Upload a picture</span>
        <span class="text-[10px] text-muted-foreground">or drop or paste one anywhere in this panel</span>
    </button>
    <button type="button" id="back" class="${LINK} self-start" hidden>Back to your meme</button>
    <div id="template-area" class="flex min-h-0 flex-1 flex-col gap-2">
        <input type="search" id="search" placeholder="Search templates" aria-label="Search templates" autocomplete="off" spellcheck="false" class="h-7 w-full flex-none rounded-sm border border-border bg-background px-2 text-[11px] focus:border-primary focus:outline-none" />
        <p id="templates-note" class="flex-none text-[10px] text-muted-foreground" hidden></p>
        <div id="grid" class="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto" role="group" aria-label="Meme templates"></div>
        <p id="no-match" class="flex-none text-[10px] text-muted-foreground" hidden>No templates match that search.</p>
    </div>
</section>
<section id="editor" class="flex min-h-0 flex-1 flex-col" aria-label="Captions" hidden>
    <div class="flex flex-none items-center justify-between gap-2 px-3 pt-2">
        <span id="source-name" class="min-w-0 truncate text-[11px] font-medium"></span>
        <button type="button" id="change" class="${SMALL_BTN}">Change picture</button>
    </div>
    <div class="flex-none px-3 pt-2">
        <div id="stage" class="flex h-40 items-center justify-center">
            <div id="frame" class="relative h-(--fh) w-(--fw)">
                <canvas id="preview" class="block size-full rounded-sm" role="img" aria-label="Preview of the meme"></canvas>
                <div id="overlays" class="absolute inset-0"></div>
            </div>
            <div id="missing" class="flex size-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground" hidden>
                <span id="missing-text"></span>
                <button type="button" id="choose-again" class="${SMALL_BTN} text-foreground">Choose picture</button>
            </div>
        </div>
    </div>
    <div id="boxes" class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2"></div>
    <div class="flex flex-none justify-start px-3 pb-2">
        <button type="button" id="add-box" class="${SMALL_BTN} disabled:cursor-default disabled:opacity-40">Add caption</button>
    </div>
</section>
<footer class="flex flex-none flex-col gap-1.5 border-t border-border bg-surface px-3 pt-1.5 pb-2">
    <div id="status" role="status" aria-live="polite" class="min-h-7 text-[10px]/[14px] text-muted-foreground data-[tone=bad]:text-destructive data-[tone=good]:text-success"></div>
    <div class="flex justify-end gap-1.5">
        <button type="button" id="edit-selected" class="${BTN}" hidden>Edit selected</button>
        <button type="button" id="place" class="${BTN} ${PRIMARY}" data-variant="primary" disabled>Place on board</button>
        <button type="button" id="update" class="${BTN} ${PRIMARY}" data-variant="primary" hidden>Update on board</button>
    </div>
</footer>
`;

export function shellHtml(js: string): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="drawdy-styling">:root{/*__DRAWDY_STYLING__*/}</style>
<style>${fontFaceCss()}</style>
<style>${PANEL_CSS}</style>
</head>
<body class="flex h-screen flex-col overflow-hidden bg-background text-xs/[1.4] text-foreground antialiased">
${BODY}
<script>${js}</script>
</body>
</html>`;
}
