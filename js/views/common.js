// 여러 화면이 함께 쓰는 조각들
import { h, modal, btn } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { estimateTokens } from '../core/spec.js';
import { lineDiff, inlineSpan } from '../core/diff.js';

/** 크게 쓰기 — 원래 textarea와 양방향 동기화 */
export function openFocusEditor(ta, label) {
  const big = h('textarea', { class: `textarea${ta.classList.contains('code') ? ' code' : ''}`, spellcheck: ta.getAttribute('spellcheck') || 'true' });
  big.value = ta.value;
  const meta = h('span.field-meta');
  const upd = () => { meta.textContent = `${estimateTokens(big.value).toLocaleString()} 토큰  ${[...big.value].length.toLocaleString()}자`; };
  big.addEventListener('input', () => {
    ta.value = big.value;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    upd();
  });
  upd();
  modal({
    title: label,
    size: 'full',
    body: [h('div.field-head', { style: { marginBottom: '8px' } }, h('span.field-hint', null, '입력하는 즉시 저장돼요. Esc로 닫기'), meta), big],
  });
  requestAnimationFrame(() => { big.focus(); big.setSelectionRange(big.value.length, big.value.length); });
}

export function emptyDetail({ ico = 'info', title, text, action }) {
  return h('div.empty-detail', null, h('div', null,
    h('div', { style: { color: 'var(--faint)' } }, icon(ico, 'lg')),
    h('h3', null, title),
    h('p', null, text),
    action || null));
}

export function subHead(title, extra) {
  return h('div.sub-head', null, h('h4', null, title), extra || null);
}

/** diff 줄 렌더 (같은 줄 묶음은 접어서 표시) */
export function renderLineDiff(before, after) {
  const ops = lineDiff(before, after);
  const out = h('div.diff-lines');
  const CONTEXT = 2;
  const keep = ops.map((o, i) => o.t !== 'eq' || ops.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1).some((x) => x.t !== 'eq'));
  let skipped = 0;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (!keep[i]) { skipped++; continue; }
    if (skipped) { out.append(h('div.gap', null, `… 같은 줄 ${skipped}개`)); skipped = 0; }
    // 바로 이어지는 del/add 쌍은 글자 단위 강조
    if (o.t === 'del' && ops[i + 1]?.t === 'add') {
      const sp = inlineSpan(o.s, ops[i + 1].s);
      out.append(h('div.del', null, sp.old[0], sp.old[1] ? h('mark', null, sp.old[1]) : null, sp.old[2]));
      out.append(h('div.add', null, sp.neu[0], sp.neu[1] ? h('mark', null, sp.neu[1]) : null, sp.neu[2]));
      i++;
      continue;
    }
    out.append(h(`div.${o.t}`, null, o.s || ' '));
  }
  if (skipped) out.append(h('div.gap', null, `… 같은 줄 ${skipped}개`));
  return out;
}

export function diffView(d) {
  const secs = [];
  if (!d.total) return h('p', null, '바뀐 곳이 없어요.');
  if (d.image) secs.push(h('div.diff-sec', null, h('h4', null, icon('image', 'sm'), '카드 이미지'), h('p', null, '이미지가 바뀌었어요.')));
  if (d.card.length) {
    secs.push(h('div.diff-sec', null, h('h4', null, icon('card', 'sm'), `카드 (${d.card.length})`),
      d.card.map((c) => h('div.diff-field', null, h('div.df-head', null, c.label), renderLineDiff(c.before, c.after)))));
  }
  const L = d.lore;
  if (L.added.length || L.removed.length || L.changed.length || d.loreMeta) {
    secs.push(h('div.diff-sec', null, h('h4', null, icon('book', 'sm'), '로어북'),
      (L.added.length || L.removed.length) ? h('ul.diff-list', { style: { marginBottom: '10px' } },
        L.added.map((e) => h('li', null, h('span.pill.ok', null, '추가'), e.comment || (e.key || []).join(', ') || `#${e.uid}`)),
        L.removed.map((e) => h('li', null, h('span.pill.danger', null, '삭제'), e.comment || (e.key || []).join(', ') || `#${e.uid}`))) : null,
      L.changed.map(({ entry, changes }) => h('div.diff-field', null,
        h('div.df-head', null, h('span.pill.warn', null, '수정'), entry.comment || `#${entry.uid}`),
        changes.map((c) => [h('div.df-head', { style: { background: 'transparent', fontWeight: 560, color: 'var(--muted)' } }, c.label), renderLineDiff(c.before, c.after)])))));
  }
  const R = d.regex;
  if (R.added.length || R.removed.length || R.changed.length) {
    secs.push(h('div.diff-sec', null, h('h4', null, icon('regex', 'sm'), '정규식'),
      h('ul.diff-list', { style: { marginBottom: '10px' } },
        R.added.map((r) => h('li', null, h('span.pill.ok', null, '추가'), r.scriptName)),
        R.removed.map((r) => h('li', null, h('span.pill.danger', null, '삭제'), r.scriptName))),
      R.changed.map(({ script, changes }) => h('div.diff-field', null,
        h('div.df-head', null, h('span.pill.warn', null, '수정'), script.scriptName),
        changes.map((c) => [h('div.df-head', { style: { background: 'transparent', fontWeight: 560, color: 'var(--muted)' } }, c.label), renderLineDiff(c.before, c.after)])))));
  }
  return h('div', null, secs);
}

export function moveItem(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

export { btn };
