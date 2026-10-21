import type { MemeSpec, Template, TemplateCache } from "./spec";

export type RenderedMeme = {
    dataUrl: string;
    pixelWidth: number;
    pixelHeight: number;
    /** Board units. */
    width: number;
    height: number;
    spec: MemeSpec;
};

export type WebviewToDriver =
    | { type: "ready" }
    | { type: "settings"; settings: Record<string, unknown> }
    | ({ type: "place" } & RenderedMeme)
    | ({ type: "update" } & RenderedMeme)
    | { type: "edit-selected" }
    | { type: "stop-edit" }
    | { type: "cache-templates"; fetchedAt: number; memes: Template[] }
    | { type: "store-upload"; key: string; dataUrl: string }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "close" };

export type DriverToWebview =
    | {
          type: "init";
          settings?: Record<string, unknown>;
          templates: TemplateCache | null;
      }
    | { type: "theme"; cssVars: string }
    | { type: "selection"; editable: boolean }
    | { type: "load"; spec: MemeSpec; uploadDataUrl: string | null }
    | { type: "edit-ended" }
    | { type: "placed"; mode: "new" }
    | {
          type: "placed";
          mode: "update";
          undoSteps: number;
          rotationReset: boolean;
      }
    | { type: "error"; message: string };
