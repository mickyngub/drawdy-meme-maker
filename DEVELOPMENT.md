# Developing Meme Maker

```bash
npm install
npm test
npm run typecheck
npm run dev          # Tailwind watcher plus the dev server on :5191; in Drawdy run ⌘K → "Add extension dev server" on a local board
npm run css          # regenerates src/panel-css.ts from webview/panel.css
npm run build        # regenerates src/panel-css.ts, src/webview-html.ts and dist/*.drawdyx
npm run preflight    # before submitting: committed, built, pushed, under Drawdy's limits, above the live version
```

Drawdy builds published versions from this repository's `src/index.ts`, so commit `src/panel-css.ts` and `src/webview-html.ts` after `npm run build`. The panel is styled with Tailwind CSS v4 utilities: `webview/panel.css` maps Drawdy's theme variables onto Tailwind colours and radii, so the panel follows the board's light and dark themes. Bump `driverVersion` in `manifest.json` for every release and add it to `CHANGELOG.md`. `npm test` holds the manifest and listing files to Drawdy's submission rules (a description of at most 500 characters, an icon of at most 256 KB, only `@drawdy/driver-protocol` imported from outside the repository).
