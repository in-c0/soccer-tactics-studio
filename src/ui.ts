// Tiny DOM helpers for the control panel. No framework, no virtual DOM —
// the panel is cheap enough to rebuild whenever the structure changes.

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k === 'value') (el as HTMLInputElement).value = String(v);
    else if (k === 'checked') (el as HTMLInputElement).checked = Boolean(v);
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) {
    if (kid === null || kid === undefined) continue;
    el.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

export function field(label: string, control: HTMLElement): HTMLElement {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control);
}

export function slider(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onInput: (v: number) => void
): HTMLElement {
  const range = h('input', { type: 'range', min, max, step, value }) as HTMLInputElement;
  const num = h('input', { type: 'number', min, max, step, value, class: 'num' }) as HTMLInputElement;
  range.addEventListener('input', () => {
    num.value = range.value;
    onInput(Number(range.value));
  });
  num.addEventListener('input', () => {
    range.value = num.value;
    onInput(Number(num.value));
  });
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'slider' }, range, num));
}

export function number(
  label: string,
  value: number,
  step: number,
  onInput: (v: number) => void,
  min?: number,
  max?: number
): HTMLElement {
  const inp = h('input', { type: 'number', step, value, min, max, class: 'num wide' }) as HTMLInputElement;
  inp.addEventListener('input', () => onInput(Number(inp.value)));
  return field(label, inp);
}

export function color(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const hex = value.length > 7 ? value.slice(0, 7) : value;
  const inp = h('input', { type: 'color', value: hex, class: 'color' }) as HTMLInputElement;
  inp.addEventListener('input', () => onInput(inp.value));
  return field(label, inp);
}

/** Colour + alpha, stored as #rrggbbaa. */
export function colorAlpha(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const hex = value.slice(0, 7);
  const alpha = value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1;
  const c = h('input', { type: 'color', value: hex, class: 'color' }) as HTMLInputElement;
  const a = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: alpha }) as HTMLInputElement;
  const emit = () => {
    const av = Math.round(Number(a.value) * 255)
      .toString(16)
      .padStart(2, '0');
    onInput(`${c.value}${av}`);
  };
  c.addEventListener('input', emit);
  a.addEventListener('input', emit);
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'slider' }, c, a));
}

export function check(label: string, value: boolean, onInput: (v: boolean) => void): HTMLElement {
  const inp = h('input', { type: 'checkbox', checked: value }) as HTMLInputElement;
  inp.addEventListener('change', () => onInput(inp.checked));
  return h('label', { class: 'field check' }, inp, h('span', {}, label));
}

export function select<T extends string>(
  label: string,
  value: T,
  options: [T, string][],
  onInput: (v: T) => void
): HTMLElement {
  const sel = h('select', {}) as HTMLSelectElement;
  for (const [v, l] of options) sel.append(h('option', { value: v, selected: v === value }, l));
  sel.value = value;
  sel.addEventListener('change', () => onInput(sel.value as T));
  return field(label, sel);
}

export function textInput(
  label: string,
  value: string,
  onInput: (v: string) => void,
  onCommit?: (v: string) => void
): HTMLElement {
  const inp = h('input', { type: 'text', value, class: 'text' }) as HTMLInputElement;
  inp.addEventListener('input', () => onInput(inp.value));
  if (onCommit) inp.addEventListener('change', () => onCommit(inp.value));
  return field(label, inp);
}

export function textArea(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const inp = h('textarea', { rows: 3 }) as HTMLTextAreaElement;
  inp.value = value;
  inp.addEventListener('input', () => onInput(inp.value));
  return field(label, inp);
}

export function button(label: string, onClick: () => void, cls = ''): HTMLElement {
  return h('button', { class: `btn ${cls}`, onclick: onClick, type: 'button' }, label);
}

export function buttonRow(...kids: HTMLElement[]): HTMLElement {
  return h('div', { class: 'btn-row' }, ...kids);
}

export function note(text: string): HTMLElement {
  return h('p', { class: 'note' }, text);
}

const openSections = new Set<string>(['Situation', 'Players', 'Camera']);

export function section(title: string, ...children: (HTMLElement | null)[]): HTMLElement {
  const open = openSections.has(title);
  const body = h('div', { class: 'section-body' }, ...children.filter(Boolean));
  const head = h(
    'button',
    {
      class: 'section-head',
      type: 'button',
      onclick: () => {
        const nowOpen = !openSections.has(title);
        if (nowOpen) openSections.add(title);
        else openSections.delete(title);
        wrap.classList.toggle('open', nowOpen);
      },
    },
    h('span', { class: 'chev' }, '▸'),
    title
  );
  const wrap = h('div', { class: `section${open ? ' open' : ''}` }, head, body);
  return wrap;
}

export function listRow(
  label: string,
  selected: boolean,
  onClick: () => void,
  swatch?: string,
  actions?: HTMLElement[]
): HTMLElement {
  return h(
    'div',
    { class: `list-row${selected ? ' selected' : ''}`, onclick: onClick },
    swatch ? h('span', { class: 'swatch', style: `background:${swatch}` }) : null,
    h('span', { class: 'list-label' }, label),
    ...(actions ?? [])
  );
}

export function iconButton(glyph: string, title: string, onClick: (ev: MouseEvent) => void): HTMLElement {
  return h(
    'button',
    {
      class: 'icon-btn',
      type: 'button',
      title,
      onclick: (ev: Event) => {
        ev.stopPropagation();
        onClick(ev as MouseEvent);
      },
    },
    glyph
  );
}
