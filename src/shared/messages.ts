export type WebviewToDriver =
    | { type: "ready" }
    | { type: "settings"; settings: Record<string, unknown> }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "close" };

export type DriverToWebview =
    | { type: "init"; settings?: Record<string, unknown> }
    | { type: "theme"; cssVars: string }
    | { type: "selection"; editable: boolean }
    | { type: "error"; message: string };
