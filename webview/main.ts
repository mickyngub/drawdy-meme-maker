import type { DriverToWebview, WebviewToDriver } from "../src/shared/messages";
import { isField, keyAction } from "./lib/keys";

type DrawdyWebviewApi = {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    onMessage(listener: (message: unknown) => void): () => void;
};

declare function acquireDrawdyApi(): DrawdyWebviewApi;

const api = acquireDrawdyApi();
const byId = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

const closeButton = byId<HTMLButtonElement>("close");
const statusLine = byId<HTMLDivElement>("status");

function send(message: WebviewToDriver): void {
    api.postMessage(message);
}

function setStatus(text: string, tone: "" | "good" | "bad" = ""): void {
    statusLine.textContent = text;
    statusLine.dataset.tone = tone;
}

function wire(): void {
    closeButton.addEventListener("click", () => send({ type: "close" }));
    document.addEventListener("keydown", (event) => {
        const action = keyAction(event, isField(event.target));
        if (!action) return;
        event.preventDefault();
        if (action === "blur") (event.target as HTMLElement).blur();
        else send({ type: action });
    });
}

function handle(message: DriverToWebview): void {
    switch (message.type) {
        case "theme": {
            const node = document.getElementById("drawdy-styling");
            if (node) node.textContent = `:root{${message.cssVars}}`;
            return;
        }
        case "error": {
            setStatus(message.message, "bad");
            return;
        }
        case "init":
        case "selection": {
            return;
        }
    }
}

wire();

api.onMessage((raw) => {
    if (!raw || typeof raw !== "object") return;
    handle(raw as DriverToWebview);
});

send({ type: "ready" });
