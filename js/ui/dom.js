// ─────────────────────────────────────────────────────────────
//  dom.js — 작은 DOM 헬퍼와 공용 위젯
// ─────────────────────────────────────────────────────────────
import { icon } from './icons.js';
import { estimateTokens } from '../core/spec.js';

/** h('div.cls#id', {props}, ...children) */
export function h(tag, props, ...kids) {
  let [name, ...rest] = tag.split(/(?=[.#])/);
  const el = name === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement(name || 'div');
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else if (r[0] === '#') el.id = r.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    kids.unshift(props);
    props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.append(k);
    else el.append(document.createTextNode(String(k)));
  }
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** 버튼 단축 */
export function btn(label, opts = {}) {
  const { kind = '', ico, onClick, title, size, disabled, type = 'button', attrs = {} } = opts;
  const cls = ['btn', kind, size, !label && ico ? 'icon' : ''].filter(Boolean).join(' ');
  return h('button', { class: cls, type, title: title || (label ? null : opts.aria), 'aria-label': !label ? (title || opts.aria) : null, onclick: onClick, disabled, ...attrs },
    ico ? icon(ico, size === 'sm' ? 'sm' : '') : null, label || null);
}

/* ── 토스트 ── */
export function toast(msg, kind = 'ok', ms = 2600) {
  let wrap = $('.toasts');
  if (!wrap) { wrap = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.append(wrap); }
  const t = h('div', { class: `toast ${kind}` }, icon(kind === 'err' ? 'alert' : kind === 'warn' ? 'info' : 'check', 'sm'), h('span', null, msg));
  wrap.append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms);
}

/* ── 모달 ── */
export function modal({ title, body, actions = [], size = '', onClose, dismissable = true }) {
  const prevFocus = document.activeElement;
  const back = h('div.modal-back');
  const box = h('div', { class: `modal ${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = (v) => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose?.(v);
    prevFocus?.focus?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) { e.stopPropagation(); close(null); }
  };
  document.addEventListener('keydown', onKey, true);
  if (dismissable) back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
  box.append(
    h('div.modal-head', null, h('h3', null, title), btn('', { kind: 'ghost', ico: 'x', size: 'sm', title: '닫기', onClick: () => close(null) })),
    h('div.modal-body', null, body),
  );
  if (actions.length) {
    box.append(h('div.modal-foot', null, actions.map((a) => btn(a.label, {
      kind: a.kind || '', ico: a.ico, onClick: async () => {
        if (!a.onClick) { close(a.value); return; }
        const r = await a.onClick();
        if (r === false) return; // 액션이 닫기를 막음
        close(a.value ?? r);
      },
    }))));
  }
  back.append(box);
  document.body.append(back);
  requestAnimationFrame(() => {
    const f = box.querySelector('[autofocus], .modal-body input, .modal-body textarea, .modal-foot .btn.primary');
    f?.focus?.();
  });
  return { close, el: box };
}

/** 확인 대화상자 → Promise<boolean> */
export function ask({ title, message, ok = '확인', cancel = '취소', danger = false }) {
  return new Promise((res) => {
    modal({
      title,
      body: typeof message === 'string' ? h('p', null, message) : message,
      onClose: (v) => res(v === true),
      actions: [
        { label: cancel, kind: 'ghost', value: false },
        { label: ok, kind: danger ? 'danger solid' : 'primary', value: true },
      ],
    });
  });
}

/** 선택지 대화상자 → Promise<value|null> */
export function choose({ title, message, options }) {
  return new Promise((res) => {
    modal({
      title,
      body: typeof message === 'string' ? h('p', null, message) : message,
      onClose: (v) => res(v ?? null),
      actions: options.map((o) => ({ label: o.label, kind: o.kind || '', value: o.value })),
    });
  });
}

/** 한 줄 입력 대화상자 */
export function prompt({ title, label, value = '', ok = '확인', placeholder = '' }) {
  return new Promise((res) => {
    const input = h('input.input', { value, placeholder, autofocus: true });
    const m = modal({
      title,
      body: h('div.field', null, label ? h('div.field-label', null, label) : null, input),
      onClose: (v) => res(v),
      actions: [
        { label: '취소', kind: 'ghost', value: null },
        { label: ok, kind: 'primary', onClick: () => input.value },
      ],
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); m.close(input.value); }
    });
  });
}

/* ── 팝업 메뉴 ── */
export function popMenu(anchor, items) {
  document.querySelector('.menu')?.remove();
  const menu = h('div.menu', { role: 'menu' }, items.map((it) => it === '-' ? h('hr') : h('button', {
    role: 'menuitem', class: it.danger ? 'danger' : '', onclick: () => { close(); it.onClick(); },
  }, icon(it.ico || 'info', 'sm'), it.label)));
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = Math.min(r.right - mw, innerWidth - mw - 8);
  left = Math.max(8, left);
  let top = r.bottom + 6;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  Object.assign(menu.style, { left: `${left}px`, top: `${top}px` });
  const close = () => { menu.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', esc, true); };
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } };
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', esc, true); });
  menu.querySelector('button')?.focus();
}

/* ── 폼 위젯 ── */
export function autosize(ta) {
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight + 2, 0)}px`;
  };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
  ta._fit = fit;
  return ta;
}

const isIME = (e) => e.isComposing || e.keyCode === 229;

/**
 * 긴 텍스트 필드 (토큰/글자 수 + 크게 쓰기)
 */
export function textField({ label, hint, help, get, set, rows = 4, mono = false, tokens = true, placeholder = '', onExpand, id }) {
  const ta = h('textarea', { class: `textarea${mono ? ' code' : ''}`, rows, placeholder, spellcheck: mono ? 'false' : 'true', id });
  ta.value = get() ?? '';
  const tok = h('span.tok');
  const chars = h('span');
  const upd = () => {
    const v = ta.value;
    tok.replaceChildren(h('b', null, estimateTokens(v).toLocaleString()), ' 토큰');
    chars.textContent = `${[...v].length.toLocaleString()}자`;
  };
  ta.addEventListener('input', () => { set(ta.value); upd(); });
  upd();
  autosize(ta);
  const expand = onExpand ? h('button.expand-btn', { type: 'button', title: '크게 쓰기', 'aria-label': `${label} 크게 쓰기`, onclick: () => onExpand(ta, label) }, icon('expand', 'sm')) : null;
  const wrap = h('div.field', null,
    h('div.field-head', null,
      h('label.field-label', { for: id }, label),
      hint ? h('span.field-hint', null, hint) : null,
      h('span.field-meta', null, tokens ? tok : null, chars, expand)),
    help ? h('p.field-help', null, help) : null,
    ta);
  wrap._ta = ta;
  wrap._refresh = () => { ta.value = get() ?? ''; upd(); ta._fit?.(); };
  return wrap;
}

export function inputField({ label, hint, get, set, type = 'text', placeholder = '', mono = false, min, max, step, id, list, help, nullable = false }) {
  const inp = h('input', { class: `input${mono ? ' code' : ''}`, type, placeholder, min, max, step, id, list, spellcheck: mono ? 'false' : null });
  const v = get();
  inp.value = v == null ? '' : v;
  inp.addEventListener('input', () => {
    if (type === 'number') {
      if (inp.value === '') { set(nullable ? null : 0); return; }
      const n = Number(inp.value);
      if (Number.isFinite(n)) set(n);
    } else set(inp.value);
  });
  return h('div.field', null,
    label ? h('div.field-head', null, h('label.field-label', { for: id }, label), hint ? h('span.field-hint', null, hint) : null) : null,
    help ? h('p.field-help', null, help) : null,
    inp);
}

export function selectField({ label, hint, get, set, options, id, numeric = true }) {
  const sel = h('select.select', { id }, options.map((o) => h('option', { value: String(o.v) }, o.label)));
  const cur = get();
  sel.value = cur == null ? String(options[0].v) : String(cur);
  sel.addEventListener('change', () => {
    const raw = sel.value;
    const o = options.find((x) => String(x.v) === raw);
    set(o ? o.v : numeric ? Number(raw) : raw);
  });
  return h('div.field', null,
    label ? h('div.field-head', null, h('label.field-label', { for: id }, label), hint ? h('span.field-hint', null, hint) : null) : null,
    sel);
}

export function toggle({ label, get, set, title }) {
  const inp = h('input', { type: 'checkbox', checked: !!get() });
  inp.addEventListener('change', () => set(inp.checked));
  return h('label.toggle', { title }, inp, h('span.track'), h('span', null, label));
}

export function segmented({ options, get, set, label }) {
  const wrap = h('div.seg', { role: 'group', 'aria-label': label });
  const render = () => {
    wrap.replaceChildren(...options.map((o) => h('button', {
      type: 'button', 'aria-pressed': String(get() === o.v),
      onclick: () => { set(o.v); render(); },
    }, o.ico ? icon(o.ico, 'sm') : null, o.label)));
  };
  render();
  return wrap;
}

/**
 * 칩 입력 (키워드·태그). 한글 조합 중 Enter 중복 입력 방지 포함.
 */
export function chipInput({ get, set, placeholder = '입력 후 Enter', mono = false, label, id }) {
  const box = h('div.chips');
  const inp = h('input', { placeholder, id, 'aria-label': label, spellcheck: 'false' });
  const commit = (raw) => {
    const parts = String(raw).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return false;
    const cur = [...get()];
    for (const p of parts) if (!cur.includes(p)) cur.push(p);
    set(cur);
    render();
    return true;
  };
  const render = () => {
    const vals = get();
    box.replaceChildren(...vals.map((v, i) => h('span', { class: `chip${mono ? ' code' : ''}`, title: v },
      h('span.chip-text', { ondblclick: () => { const cur = [...get()]; cur.splice(i, 1); set(cur); render(); inp.value = v; inp.focus(); } }, v === '' ? '(빈 키워드)' : v),
      h('button.x', { type: 'button', 'aria-label': `${v} 삭제`, onclick: (e) => { e.stopPropagation(); const cur = [...get()]; cur.splice(i, 1); set(cur); render(); inp.focus(); } }, icon('x', 'sm')))), inp);
  };
  inp.addEventListener('keydown', (e) => {
    if (isIME(e)) return;
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab' && inp.value.trim()) {
      if (inp.value.trim()) { e.preventDefault(); commit(inp.value); inp.value = ''; }
      else if (e.key === 'Enter') e.preventDefault();
    } else if (e.key === 'Backspace' && !inp.value) {
      const cur = [...get()];
      if (cur.length) { const last = cur.pop(); set(cur); render(); inp.value = last; e.preventDefault(); }
    }
  });
  inp.addEventListener('paste', (e) => {
    const t = e.clipboardData?.getData('text') || '';
    if (/[,\n]/.test(t)) { e.preventDefault(); commit(inp.value + t); inp.value = ''; }
  });
  inp.addEventListener('blur', () => { if (inp.value.trim()) { commit(inp.value); inp.value = ''; } });
  box.addEventListener('click', (e) => { if (e.target === box) inp.focus(); });
  render();
  box._render = render;
  return box;
}

/** 날짜 포맷 */
export function fmtDate(ts, withTime = true) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  const s = `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  return withTime ? `${s} ${p(d.getHours())}:${p(d.getMinutes())}` : s;
}
export function fmtAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return '방금';
  if (s < 60) return `${s}초 전`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}분 전`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr}시간 전`;
  const d = Math.round(hr / 24);
  if (d < 8) return `${d}일 전`;
  return fmtDate(ts, false);
}

/** 파일 고르기 */
export function pickFiles({ accept = '', multiple = false } = {}) {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    inp.addEventListener('change', () => { res([...inp.files]); inp.remove(); });
    inp.addEventListener('cancel', () => { res([]); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

/** 다운로드 */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

export async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name });
    return true;
  }
  return false;
}
export const canShareFiles = () => !!(navigator.canShare && matchMedia('(hover: none)').matches);
