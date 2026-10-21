const FOCUS =
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";
const LABEL = "text-[10px] tracking-[0.02em] text-muted-foreground";
const INPUT =
    "h-6 rounded-sm border border-border bg-background py-0.5 text-[11px] focus:border-primary focus:outline-none disabled:opacity-40";
const SEG_BUTTON = `min-w-0 flex-auto cursor-pointer truncate rounded-sm border border-border px-1.5 py-[3px] text-[10px] text-muted-foreground hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground ${FOCUS}`;

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
    const wrap = el("div", "flex flex-col gap-1", parent);
    const head = el("div", "flex items-baseline justify-between gap-1.5", wrap);
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
    const value = el("span", "text-[10px] tabular-nums", head);
    const input = el(
        "input",
        `h-3.5 w-full cursor-pointer accent-primary ${FOCUS}`,
        wrap
    );
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.setAttribute("aria-label", spec.label);
    const show = (v: number) => {
        value.textContent = `${v} ${spec.unit}`;
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
    const row = el("div", "flex flex-wrap gap-[3px]", wrap);
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
    const select = el("select", `${INPUT} px-1`, wrap);
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
    const input = el("input", `${INPUT} w-full px-1.5`, wrap);
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
    const wrap = el("label", `flex items-center gap-1.5 ${LABEL}`, parent);
    wrap.textContent = label;
    const input = el("input", `${INPUT} w-16 px-1.5 tabular-nums`, wrap);
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
    const row = el("div", "flex flex-wrap items-center gap-[5px]", wrap);
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    const buttons = swatches.map((swatch) => {
        const node = button(
            row,
            `size-5 cursor-pointer rounded-full border border-border p-0 [background:var(--swatch)] aria-pressed:outline-2 aria-pressed:outline-offset-1 aria-pressed:outline-primary${
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
    el("div", "my-0.5 h-px flex-none bg-border", parent);
}
