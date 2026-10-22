export const FOCUS =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL = "text-label text-fg-muted";
const INPUT =
    "h-8 rounded-lg border border-line bg-subtle text-label text-fg transition-colors hover:bg-hover focus:border-line-strong focus:bg-active focus:outline-none focus:ring-1 focus:ring-ring disabled:text-fg-disabled";
const SEG_BUTTON = `h-7 min-w-0 flex-1 cursor-pointer truncate rounded-md px-2 text-label text-fg-subtle transition-colors hover:text-fg aria-pressed:bg-control aria-pressed:text-fg ${FOCUS}`;
export const SLIDER =
    "h-1.5 cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,var(--color-accent)_var(--fill),var(--color-control)_var(--fill))] [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgb(0_0_0/0.3)]";

export function paintFill(input: HTMLInputElement): void {
    const min = Number(input.min);
    const span = Number(input.max) - min || 1;
    input.style.setProperty(
        "--fill",
        `${((Number(input.value) - min) / span) * 100}%`
    );
}

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    parent?: HTMLElement
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
}

export function button(
    parent: HTMLElement,
    className: string,
    text: string,
    onClick: () => void,
    label?: string
): HTMLButtonElement {
    const node = el("button", `${className} ${FOCUS}`, parent);
    node.type = "button";
    node.textContent = text;
    if (label) {
        node.setAttribute("aria-label", label);
        node.title = label;
    }
    node.addEventListener("click", onClick);
    return node;
}

function field(parent: HTMLElement, label: string, forId?: string) {
    const wrap = el("div", "flex flex-col gap-2", parent);
    const head = el("div", "flex items-center justify-between gap-2", wrap);
    const text = el(forId ? "label" : "span", LABEL, head);
    text.textContent = label;
    if (forId) (text as HTMLLabelElement).htmlFor = forId;
    return { wrap, head };
}

let uid = 0;
const nextId = (stem: string) => `${stem}-${++uid}`;

export type Control<T> = { set(value: T): void };

export type SliderSpec = {
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
};

export function makeSlider(
    parent: HTMLElement,
    spec: SliderSpec,
    initial: number,
    onInput: (value: number) => void
): Control<number> {
    const { wrap, head } = field(parent, spec.label);
    const value = el("span", "text-fg-subtle tabular-nums", head);
    const input = el("input", `${SLIDER} w-full ${FOCUS}`, wrap);
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.setAttribute("aria-label", spec.label);
    const show = (v: number) => {
        value.textContent = spec.unit ? `${v} ${spec.unit}` : String(v);
        paintFill(input);
    };
    input.value = String(initial);
    show(initial);
    input.addEventListener("input", () => {
        const v = Number(input.value);
        show(v);
        onInput(v);
    });
    return {
        set(v) {
            input.value = String(v);
            show(v);
        },
    };
}

export function makeSegmented<T extends string | number>(
    row: HTMLElement,
    options: [T, string][],
    initial: T,
    onPick: (value: T) => void
): Control<T> {
    const buttons = options.map(([value, caption]) => {
        const node = button(row, SEG_BUTTON, caption, () => {
            paint(value);
            onPick(value);
        });
        return { value, node };
    });
    const paint = (current: T) => {
        for (const entry of buttons) {
            entry.node.setAttribute(
                "aria-pressed",
                String(entry.value === current)
            );
        }
    };
    paint(initial);
    return { set: paint };
}

export function makeSegmentedField<T extends string | number>(
    parent: HTMLElement,
    label: string,
    options: [T, string][],
    initial: T,
    onPick: (value: T) => void
): Control<T> & { wrap: HTMLElement; row: HTMLElement } {
    const { wrap } = field(parent, label);
    const row = el(
        "div",
        "flex h-8 gap-0.5 rounded-lg bg-control-subtle p-0.5",
        wrap
    );
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    const control = makeSegmented(row, options, initial, onPick);
    return { ...control, wrap, row };
}

export function makeToggle(
    parent: HTMLElement,
    caption: string,
    initial: boolean,
    onChange: (value: boolean) => void
): Control<boolean> {
    let value = initial;
    const node = button(parent, SEG_BUTTON, caption, () => {
        paint(!value);
        onChange(value);
    });
    const paint = (next: boolean) => {
        value = next;
        node.setAttribute("aria-pressed", String(next));
    };
    paint(initial);
    return { set: paint };
}

export function makeSelect(
    parent: HTMLElement,
    label: string,
    options: [string, string][],
    initial: string,
    onPick: (value: string) => void
): Control<string> {
    const id = nextId("select");
    const { wrap } = field(parent, label, id);
    const select = el("select", `${INPUT} px-3`, wrap);
    select.id = id;
    for (const [value, caption] of options) {
        const option = el("option", undefined, select);
        option.value = value;
        option.textContent = caption;
    }
    select.value = initial;
    select.addEventListener("change", () => onPick(select.value));
    return {
        set(value) {
            select.value = value;
        },
    };
}

export function makeTextInput(
    parent: HTMLElement,
    label: string,
    placeholder: string,
    maxLength: number,
    onInput: (value: string) => void
): Control<string> & { input: HTMLInputElement; wrap: HTMLElement } {
    const id = nextId("text");
    const { wrap } = field(parent, label, id);
    const input = el("input", `${INPUT} w-full px-3`, wrap);
    input.id = id;
    input.type = "text";
    input.placeholder = placeholder;
    input.maxLength = maxLength;
    input.spellcheck = false;
    input.addEventListener("input", () => onInput(input.value));
    return {
        input,
        wrap,
        set(value) {
            input.value = value;
        },
    };
}

export function makeNumberInput(
    parent: HTMLElement,
    label: string,
    range: { min: number; max: number },
    initial: number,
    onChange: (value: number) => void
): Control<number> & { input: HTMLInputElement } {
    const wrap = el("label", `flex items-center gap-2 ${LABEL}`, parent);
    wrap.textContent = label;
    const input = el("input", `${INPUT} w-16 px-2 tabular-nums`, wrap);
    input.type = "number";
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = "1";
    input.value = String(initial);
    const read = () => {
        const raw = Math.round(Number(input.value));
        const value = Number.isFinite(raw)
            ? Math.min(range.max, Math.max(range.min, raw))
            : range.min;
        return value;
    };
    input.addEventListener("input", () => {
        if (input.value.trim() !== "") onChange(read());
    });
    input.addEventListener("change", () => {
        const value = read();
        input.value = String(value);
        onChange(value);
    });
    return {
        input,
        set(value) {
            input.value = String(value);
        },
    };
}

export type Swatch = {
    value: string;
    label: string;
    css: string;
    className?: string;
};

export function makeSwatchRow(
    parent: HTMLElement,
    label: string,
    swatches: Swatch[],
    initial: string,
    onPick: (value: string) => void
): Control<string> & {
    row: HTMLElement;
    nodes: Map<string, HTMLButtonElement>;
} {
    const { wrap } = field(parent, label);
    const row = el("div", "flex flex-wrap items-center gap-2", wrap);
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    const buttons = swatches.map((swatch) => {
        const node = button(
            row,
            `size-6 cursor-pointer rounded-full p-0 ring-1 ring-black/10 ring-inset [background:var(--swatch)] aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-fg${
                swatch.className ? ` ${swatch.className}` : ""
            }`,
            "",
            () => {
                paint(swatch.value);
                onPick(swatch.value);
            },
            swatch.label
        );
        if (swatch.css) node.style.setProperty("--swatch", swatch.css);
        return { value: swatch.value, node };
    });
    const paint = (current: string) => {
        for (const entry of buttons) {
            entry.node.setAttribute(
                "aria-pressed",
                String(entry.value === current)
            );
        }
    };
    paint(initial);
    return {
        set: paint,
        row,
        nodes: new Map(buttons.map((entry) => [entry.value, entry.node])),
    };
}

export function makeRule(parent: HTMLElement): void {
    el("div", "h-px flex-none bg-divider", parent);
}
