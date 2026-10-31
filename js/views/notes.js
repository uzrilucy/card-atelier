// 제작 메모
import { h, btn, toggle, ask, fmtAgo, autosize } from '../ui/dom.js';
import { S, touch } from '../store.js';
import { emptyDetail } from './common.js';
import { uuid } from '../core/codec.js';
import { refreshChrome } from '../ui/nav.js';

export function renderNotes(root) {
  const P = S.P;
  const split = h('div.split', { class: S.detail.note ? 'show-detail' : '' });
  const list = h('div.list', { role: 'listbox', 'aria-label': '메모 목록' });
  const detail = h('div.detail-pane.panel');

  const sorted = () => [...P.notes].sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
  const row = (n) => h('button.item', {
    type: 'button', role: 'option', 'aria-selected': String(S.sel.note === n.id), dataset: { id: n.id },
    onclick: () => { S.sel.note = n.id; S.detail.note = true; split.classList.add('show-detail'); drawList(); drawDetail(); },
  },
  h('span', { class: 'mark note', style: n.pinned ? null : { background: 'var(--line-strong)' } }),
  h('span.t', null, n.title || firstLine(n.body) || '빈 메모'),
  h('span.n', null, fmtAgo(n.updatedAt)),
  h('span.s', null, n.title ? firstLine(n.body) : (n.body.split('\n')[1] || '')));
  const drawList = () => {
    list.replaceChildren(...sorted().map(row));
    if (!P.notes.length) list.append(h('p', { style: { padding: '18px 12px', color: 'var(--muted)', fontSize: '13.5px', margin: 0 } }, '아직 메모가 없어요.'));
  };
  const add = () => {
    const n = { id: uuid(), title: '', body: '', pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    P.notes.push(n); S.sel.note = n.id; S.detail.note = true; split.classList.add('show-detail');
    touch(); drawList(); drawDetail(); refreshChrome();
    requestAnimationFrame(() => detail.querySelector('.title-input')?.focus());
  };

  const drawDetail = () => {
    const n = P.notes.find((x) => x.id === S.sel.note);
    if (!n) {
      detail.replaceChildren(emptyDetail({
        ico: 'note', title: P.notes.length ? '메모를 고르세요' : '작업 메모를 남겨보세요',
        text: '할 일, 아이디어, 테스트 결과, 배포 문구 초안 같은 것들요. 카드에는 들어가지 않고, 전체 묶음 ZIP에만 함께 담겨요.',
        action: btn('메모 추가', { kind: 'primary', ico: 'plus', onClick: add }),
      }));
      return;
    }
    const stamp = () => { n.updatedAt = Date.now(); touch(); const old = list.querySelector(`.item[data-id="${n.id}"]`); old?.replaceWith(row(n)); };
    const title = h('input.title-input', { value: n.title, placeholder: '제목', 'aria-label': '메모 제목' });
    title.addEventListener('input', () => { n.title = title.value; stamp(); });
    const body = h('textarea.textarea.note-body', { placeholder: '자유롭게 적어요. 입력하는 즉시 저장돼요.', 'aria-label': '메모 내용' });
    body.value = n.body;
    body.addEventListener('input', () => { n.body = body.value; stamp(); });
    autosize(body);
    detail.replaceChildren(
      h('div.detail-head', null,
        btn('', { kind: 'ghost', ico: 'back', title: '목록으로', attrs: { class: 'btn ghost icon detail-back' }, onClick: () => { S.detail.note = false; split.classList.remove('show-detail'); } }),
        title,
        toggle({ label: '고정', get: () => n.pinned, set: (v) => { n.pinned = v; stamp(); drawList(); } }),
        btn('', { size: 'sm', kind: 'danger', ico: 'trash', title: '메모 삭제', onClick: async () => {
          if (n.body.trim() && !(await ask({ title: '메모를 삭제할까요?', message: '버전 기록에 저장된 적이 있다면 거기서 되살릴 수 있어요.', ok: '삭제', danger: true }))) return;
          P.notes.splice(P.notes.indexOf(n), 1); S.sel.note = null; S.detail.note = false; split.classList.remove('show-detail');
          touch(); drawList(); drawDetail(); refreshChrome();
        } })),
      h('div.detail-body', null, body));
  };

  root.replaceChildren(
    h('div.page-head', null,
      h('div', null, h('h2', null, '제작 메모'), h('p', null, '이 카드를 만들면서 기억해둘 것들.')),
      h('div.actions', null, btn('메모 추가', { kind: 'primary', ico: 'plus', onClick: add }))),
    split);
  split.append(h('div.panel.list-pane', null, list), detail);
  drawList();
  drawDetail();
}

const firstLine = (s) => (s || '').split('\n').find((l) => l.trim())?.trim() || '';
