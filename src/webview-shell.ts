import { PANEL_CSS } from "./panel-css";

const BODY = `
<header class="flex flex-none items-center justify-between gap-2 border-b border-border px-3 py-2">
    <h1 class="text-[13px] font-semibold">Meme Maker</h1>
    <button type="button" id="close" class="cursor-pointer rounded-sm border border-border px-2.5 py-1 text-[11px] hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">Close</button>
</header>
<main class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
    <p class="text-[11px] text-muted-foreground">Templates, captions and uploads will appear here.</p>
    <div id="status" role="status" aria-live="polite" class="min-h-7 text-[10px] text-muted-foreground data-[tone=bad]:text-destructive data-[tone=good]:text-success"></div>
</main>
`;

export function shellHtml(js: string): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="drawdy-styling">:root{/*__DRAWDY_STYLING__*/}</style>
<style>${PANEL_CSS}</style>
</head>
<body class="flex h-screen flex-col overflow-hidden bg-background text-xs/[1.4] text-foreground antialiased">
${BODY}
<script>${js}</script>
</body>
</html>`;
}
