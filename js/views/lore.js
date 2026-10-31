// 로어북(월드인포) 편집 화면
import { h, btn, textField, inputField, selectField, chipInput, toggle, segmented, toast, ask, choose, popMenu, pickFiles } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { S, touch } from '../store.js';
import { WI_POSITIONS, WI_LOGIC, ROLES, newWorldEntry, nextUid, estimateTokens } from '../core/spec.js';
import { openFocusEditor, emptyDetail, subHead, moveItem } from './common.js';
import { refreshChrome } from '../ui/nav.js';
import { analyzeFile, mergeLorebook } from '../porter.js';

const TRI = [{ v: null, label: '전역 설정 따름' }, { v: true, label: '예' }, { v: false, label: '아니오' }];
const filt = { q: '', mode: 'all' };

const posShort = (v) => WI_POSITIONS.find((p) => p.v === v)?.short ?? `#${v}`;
const kindOf = (e) => (e.disable ? 'off' : e.constant ? 'constant' : e.vectorized ? 'vector' : 'keyword');

export function renderLore(root) {
  const P = S.P;
  const book = P.lorebook;
  const split = h('div.split', { class: S.detail.lore ? 'show-detail' : '' });
  const list = h('div.list', { role: 'listbox', 'aria-label': '로어북 엔트리' });
  const foot = h('div.list-foot');
  const detail = h('div.detail-pane.panel');
  const filters = h('div.list-filters', { role: 'group', 'aria-label': '보기' });

  const visible = () => {
    const q = filt.q.trim().toLowerCase();
    return book.entries.filter((e) => {
      if (filt.mode === 'constant' && !(e.constant && !e.disable)) return false;
      if (filt.mode === 'keyword' && (e.constant || e.disable)) return false;
      if (filt.mode === 'off' && !e.disable) return false;
      if (!q) return true;
      return [e.comment, ...(e.key || []), ...(e.keysecondary || []), e.content].join('\n').toLowerCase().includes(q);
    });
  };

  const row = (e) => {
    const k = kindOf(e);
    const t = estimateTokens(e.content);
    const el = h('button.item', {
      type: 'button', role: 'option', class: k === 'off' ? 'off' : '',
      'aria-selected': String(S.sel.lore === e.uid), dataset: { uid: e.uid },
      onclick: () => { S.sel.lore = e.uid; S.detail.lore = true; split.classList.add('show-detail'); markSel(); drawDetail(); },
    },
    h('span', { class: `mark ${k}`, title: { off: '꺼짐', constant: '상시', vector: '벡터', keyword: '키워드' }[k] }),
    h('span.t', null, e.comment || (e.key || []).find(Boolean) || '제목 없음'),
    h('span.n', null, `${t.toLocaleString()}`, h('br'), posShort(e.position) + (e.position === 4 ? e.depth : '')),
    h('span.s', null, e.constant ? '항상 들어감' : (e.key || []).filter(Boolean).join(', ') || '키워드 없음'));
    return el;
  };
  const markSel = () => list.querySelectorAll('.item').forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.uid) === S.sel.lore)));
  const refreshRow = (uid) => {
    const e = book.entries.find((x) => x.uid === uid);
    const old = list.querySelector(`.item[data-uid="${uid}"]`);
    if (e && old) old.replaceWith(row(e));
    drawFoot(); drawFilters();
  };
  const drawList = () => {
    const v = visible();
    list.replaceChildren(...v.map(row));
    if (!v.length) list.append(h('p', { style: { padding: '18px 12px', color: 'var(--muted)', fontSize: '13.5px', margin: 0 } }, book.entries.length ? '조건에 맞는 엔트리가 없어요.' : '아직 엔트리가 없어요.'));
    drawFoot(); drawFilters();
  };
  const drawFoot = () => {
    const constTok = book.entries.filter((e) => e.constant && !e.disable).reduce((s, e) => s + estimateTokens(e.content), 0);
    foot.replaceChildren(h('span', null, `엔트리 ${book.entries.length}`), h('span', null, `상시 ${constTok.toLocaleString()} 토큰`));
  };
  const drawFilters = () => {
    const n = (m) => book.entries.filter((e) => (m === 'constant' ? e.constant && !e.disable : m === 'keyword' ? !e.constant && !e.disable : m === 'off' ? e.disable : true)).length;
    filters.replaceChildren(...[['all', '전체'], ['keyword', '키워드'], ['constant', '상시'], ['off', '꺼짐']].map(([m, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(filt.mode === m), onclick: () => { filt.mode = m; drawList(); } }, `${l} ${n(m)}`)));
  };

  const addEntry = () => {
    const e = newWorldEntry(nextUid(book.entries));
    book.entries.push(e);
    S.sel.lore = e.uid; S.detail.lore = true; split.classList.add('show-detail');
    filt.mode = 'all'; filt.q = ''; search.value = '';
    touch(); drawList(); drawDetail(); refreshChrome();
    requestAnimationFrame(() => detail.querySelector('.title-input')?.focus());
  };

  /* ── 상세 ── */
  const drawDetail = () => {
    const e = book.entries.find((x) => x.uid === S.sel.lore);
    if (!e) {
      detail.replaceChildren(emptyDetail({
        ico: 'book', title: book.entries.length ? '엔트리를 고르세요' : '첫 엔트리를 만들어볼까요?',
        text: '키워드가 대화에 나오면 내용이 프롬프트에 들어가요. 세계관·인물·장소·이벤트를 나눠 적어두세요.',
        action: btn('엔트리 추가', { kind: 'primary', ico: 'plus', onClick: addEntry }),
      }));
      return;
    }
    const upd = (k, opts = {}) => (v) => { e[k] = v; touch(); refreshRow(e.uid); if (opts.redraw) drawDetail(); };

    const title = h('input.title-input', { value: e.comment, placeholder: '엔트리 제목 (메모)', 'aria-label': '엔트리 제목' });
    title.addEventListener('input', () => { e.comment = title.value; touch(); refreshRow(e.uid); });
    const moreBtn = btn('', {
      size: 'sm', ico: 'more', title: '더 보기', onClick: () => popMenu(moreBtn, [
        { label: '복제', ico: 'copy', onClick: () => {
          const copy = { ...structuredClone(e), uid: nextUid(book.entries), comment: `${e.comment} 사본` };
          book.entries.splice(book.entries.indexOf(e) + 1, 0, copy); S.sel.lore = copy.uid; touch(); drawList(); drawDetail(); refreshChrome();
        } },
        { label: '위로', ico: 'up', onClick: () => { if (moveItem(book.entries, book.entries.indexOf(e), -1)) { touch(); drawList(); } } },
        { label: '아래로', ico: 'down', onClick: () => { if (moveItem(book.entries, book.entries.indexOf(e), 1)) { touch(); drawList(); } } },
        '-',
        { label: '삭제', ico: 'trash', danger: true, onClick: async () => {
          if (e.content.trim() && !(await ask({ title: '엔트리를 삭제할까요?', message: `'${e.comment || '제목 없음'}' — 버전 기록에서 되살릴 수 있어요.`, ok: '삭제', danger: true }))) return;
          book.entries.splice(book.entries.indexOf(e), 1);
          if (book.indexUid === e.uid) book.indexUid = null;
          S.sel.lore = null; S.detail.lore = false; split.classList.remove('show-detail');
          touch(); drawList(); drawDetail(); refreshChrome();
        } },
      ]),
    });

    const strategy = segmented({
      label: '발동 방식',
      options: [{ v: 'keyword', label: '키워드' }, { v: 'constant', label: '상시' }, { v: 'vector', label: '벡터' }],
      get: () => (e.constant ? 'constant' : e.vectorized ? 'vector' : 'keyword'),
      set: (v) => { e.constant = v === 'constant'; e.vectorized = v === 'vector'; touch(); refreshRow(e.uid); },
    });

    const isD = e.position === 4, isOut = e.position === 7;
    const placement = h('div.grid-3', null,
      selectField({ label: '위치', options: WI_POSITIONS.map((p) => ({ v: p.v, label: `${p.label} (${p.short})` })), get: () => e.position, set: upd('position', { redraw: true }) }),
      inputField({ label: '순서', hint: '클수록 뒤쪽', type: 'number', step: 1, get: () => e.order, set: upd('order') }),
      isD ? inputField({ label: '깊이', type: 'number', min: 0, step: 1, get: () => e.depth, set: upd('depth') }) : null,
      isD ? selectField({ label: '역할', options: [{ v: null, label: '기본(시스템)' }, ...ROLES], get: () => e.role, set: upd('role') }) : null,
      isOut ? inputField({ label: '아웃렛 이름', get: () => e.outletName, set: upd('outletName'), help: '{{outlet::이름}} 매크로 자리에 들어가요.' }) : null);

    const adv = h('details.group', { style: { borderTop: '1px solid var(--line)', marginTop: '22px' } },
      h('summary', { style: { padding: '14px 0' } }, h('h3', { style: { fontSize: '15px' } }, '세부 조건'), h('span.sum-meta', null, '확률, 그룹, 재귀, 시간 효과'), h('span.chev', null, icon('chev', 'sm'))),
      h('div', { style: { paddingBottom: '6px' } },
        h('div.grid-3', null,
          inputField({ label: '발동 확률', hint: '%', type: 'number', min: 0, max: 100, step: 1, get: () => e.probability, set: upd('probability') }),
          inputField({ label: '스캔 깊이', hint: '비우면 전역', type: 'number', min: 0, step: 1, nullable: true, get: () => e.scanDepth, set: upd('scanDepth') }),
          inputField({ label: '자동화 ID', get: () => e.automationId, set: upd('automationId') })),
        h('div.toggle-list', { style: { marginTop: '10px' } }, toggle({ label: '확률 적용', get: () => e.useProbability, set: upd('useProbability') })),
        h('div.grid-3', { style: { marginTop: '14px' } },
          selectField({ label: '대소문자 구분', options: TRI, get: () => e.caseSensitive, set: upd('caseSensitive') }),
          selectField({ label: '단어 단위 일치', options: TRI, get: () => e.matchWholeWords, set: upd('matchWholeWords') }),
          selectField({ label: '그룹 점수 사용', options: TRI, get: () => e.useGroupScoring, set: upd('useGroupScoring') })),
        subHead('포함 그룹'),
        h('div.grid-3', null,
          inputField({ label: '그룹 이름', hint: '쉼표로 여러 개', get: () => e.group, set: upd('group') }),
          inputField({ label: '그룹 가중치', type: 'number', min: 0, step: 1, get: () => e.groupWeight, set: upd('groupWeight') }),
          h('div.field', null, toggle({ label: '그룹 우선 (Override)', get: () => e.groupOverride, set: upd('groupOverride') }))),
        subHead('재귀'),
        h('div.toggle-list', null,
          toggle({ label: '다른 엔트리 내용으로는 발동 안 함', get: () => e.excludeRecursion, set: upd('excludeRecursion') }),
          toggle({ label: '이 엔트리 내용으로 다른 엔트리 발동 안 함', get: () => e.preventRecursion, set: upd('preventRecursion') }),
          toggle({ label: '재귀 단계에서만 발동', get: () => !!e.delayUntilRecursion, set: upd('delayUntilRecursion') })),
        subHead('시간 효과', h('span.field-hint', null, '메시지 수 기준, 비우면 사용 안 함')),
        h('div.grid-3', null,
          inputField({ label: '지속 (Sticky)', type: 'number', min: 0, step: 1, nullable: true, get: () => e.sticky, set: upd('sticky') }),
          inputField({ label: '쿨다운', type: 'number', min: 0, step: 1, nullable: true, get: () => e.cooldown, set: upd('cooldown') }),
          inputField({ label: '지연 (Delay)', type: 'number', min: 0, step: 1, nullable: true, get: () => e.delay, set: upd('delay') })),
        subHead('키워드를 찾을 추가 위치'),
        h('div.toggle-list', null,
          toggle({ label: '페르소나 설명', get: () => e.matchPersonaDescription, set: upd('matchPersonaDescription') }),
          toggle({ label: '캐릭터 설명', get: () => e.matchCharacterDescription, set: upd('matchCharacterDescription') }),
          toggle({ label: '캐릭터 성격', get: () => e.matchCharacterPersonality, set: upd('matchCharacterPersonality') }),
          toggle({ label: '캐릭터 노트', get: () => e.matchCharacterDepthPrompt, set: upd('matchCharacterDepthPrompt') }),
          toggle({ label: '시나리오', get: () => e.matchScenario, set: upd('matchScenario') }),
          toggle({ label: '제작자 노트', get: () => e.matchCreatorNotes, set: upd('matchCreatorNotes') }),
          toggle({ label: '토큰 예산 무시', get: () => e.ignoreBudget, set: upd('ignoreBudget') }))));

    const body = h('div.detail-body', null,
      h('div.field', null, h('div.field-head', null, h('span.field-label', null, '발동 방식')), strategy),
      h('div.field', null, h('div.field-head', null, h('label.field-label', { for: 'lk' }, '키워드'), h('span.field-hint', null, 'Enter·쉼표로 추가, /정규식/ 도 가능')),
        chipInput({ id: 'lk', label: '키워드', get: () => e.key, set: upd('key') })),
      h('div.grid-2', { style: { marginTop: '18px', alignItems: 'start' } },
        h('div.field', null, h('div.field-head', null, h('label.field-label', { for: 'lk2' }, '보조 키워드')),
          chipInput({ id: 'lk2', label: '보조 키워드', get: () => e.keysecondary, set: upd('keysecondary') })),
        selectField({ label: '보조 키워드 논리', options: WI_LOGIC, get: () => e.selectiveLogic, set: upd('selectiveLogic') })),
      h('div', { style: { marginTop: '18px' } }, textField({ label: '내용', id: 'lc', rows: 10, get: () => e.content, set: (v) => { e.content = v; touch(); refreshRow(e.uid); }, onExpand: openFocusEditor })),
      subHead('삽입 위치'),
      placement,
      adv);

    detail.replaceChildren(
      h('div.detail-head', null,
        btn('', { kind: 'ghost', ico: 'back', title: '목록으로', attrs: { class: 'btn ghost icon detail-back' }, onClick: () => { S.detail.lore = false; split.classList.remove('show-detail'); } }),
        title,
        toggle({ label: '사용', get: () => !e.disable, set: (v) => { e.disable = !v; touch(); refreshRow(e.uid); } }),
        moreBtn),
      body);
  };

  /* ── 상단 · 로어북 설정 ── */
  const search = h('input.input', { type: 'search', placeholder: '제목·키워드·내용 검색', value: filt.q, 'aria-label': '엔트리 검색' });
  search.addEventListener('input', () => { filt.q = search.value; drawList(); });

  const bookSettings = h('div.book-settings', null,
    inputField({ label: '로어북 이름', get: () => book.name, set: (v) => { book.name = v; touch(); }, placeholder: P.card.name || '비우면 캐릭터 이름', help: '실리에 월드인포로 등록될 이름이에요.' }),
    inputField({ label: '스캔 깊이', type: 'number', min: 0, nullable: true, placeholder: '전역', get: () => book.scan_depth, set: (v) => { book.scan_depth = v; touch(); } }),
    inputField({ label: '토큰 예산', type: 'number', min: 0, nullable: true, placeholder: '전역', get: () => book.token_budget, set: (v) => { book.token_budget = v; touch(); } }),
    selectField({ label: '재귀 스캔', options: TRI, get: () => book.recursive_scanning, set: (v) => { book.recursive_scanning = v; touch(); } }));

  const indexBtn = btn(book.indexUid != null && book.entries.some((x) => x.uid === book.indexUid) ? '인덱스 갱신' : '인덱스 만들기', {
    ico: 'index', title: '키워드 엔트리 목록을 담은 상시 엔트리를 만들어요', onClick: () => {
      const made = buildIndex(book);
      S.sel.lore = made.uid; S.detail.lore = true; split.classList.add('show-detail');
      touch(); drawList(); drawDetail(); refreshChrome();
      indexBtn.lastChild.textContent = '인덱스 갱신';
      toast('인덱스 엔트리를 갱신했어요.');
    },
  });

  root.replaceChildren(
    h('div.page-head', null,
      h('div', null, h('h2', null, '로어북'), h('p', null, '키워드가 등장하면 프롬프트에 끼워 넣을 설정 조각들이에요.')),
      h('div.actions', null,
        btn('가져오기', { ico: 'import', onClick: () => importLore(() => { drawList(); drawDetail(); refreshChrome(); }) }),
        indexBtn,
        btn('엔트리 추가', { kind: 'primary', ico: 'plus', onClick: addEntry }))),
    h('details.panel.group.book-box', null,
      h('summary', null, h('h3', null, '로어북 설정'), h('span.sum-meta', null, book.name || P.card.name || '이름 없음'), h('span.chev', null, icon('chev', 'sm'))),
      bookSettings),
    split);
  split.append(
    h('div.panel.list-pane', null,
      h('div.list-head', null, h('div.search', { style: { maxWidth: 'none' } }, icon('search', 'sm'), search), filters),
      list, foot),
    detail);
  drawList();
  drawDetail();
}

/** 상시 인덱스 엔트리 — 키워드 엔트리들의 제목·키워드를 한 곳에 색인 */
function buildIndex(book) {
  const lines = book.entries
    .filter((e) => e.uid !== book.indexUid && !e.constant && !e.disable && (e.key || []).some((k) => k.trim()))
    .map((e) => `- ${e.comment || e.key.find(Boolean)}: ${e.key.filter((k) => k.trim()).join(', ')}`);
  const content = `[Lorebook Index — topics that have detailed entries; mention a keyword to recall them]\n${lines.join('\n')}`;
  let idx = book.entries.find((e) => e.uid === book.indexUid);
  if (!idx) {
    idx = newWorldEntry(nextUid(book.entries), { comment: '📇 로어북 인덱스', constant: true, order: 1, position: 0 });
    book.entries.unshift(idx);
    book.indexUid = idx.uid;
  }
  idx.content = content;
  return idx;
}

async function importLore(after) {
  const [f] = await pickFiles({ accept: '.json,.png' });
  if (!f) return;
  try {
    const a = await analyzeFile(f);
    const incoming = a.kind === 'world' ? a.lorebook : a.kind === 'card' ? a.parsed.lorebook : null;
    if (!incoming || !incoming.entries.length) { toast('이 파일에는 로어북 엔트리가 없어요.', 'warn'); return; }
    const book = S.P.lorebook;
    let mode = 'append';
    if (book.entries.length) {
      mode = await choose({
        title: `엔트리 ${incoming.entries.length}개를 가져와요`,
        message: '지금 로어북에 이어 붙일까요, 통째로 바꿀까요? 바꾸기 전 상태는 자동 저장 지점으로 남겨둬요.',
        options: [{ label: '취소', kind: 'ghost', value: null }, { label: '통째로 바꾸기', value: 'replace' }, { label: '이어 붙이기', kind: 'primary', value: 'append' }],
      });
      if (!mode) return;
      if (mode === 'replace') {
        const { createSnapshot } = await import('../store.js');
        await createSnapshot('auto', { label: '로어북 바꾸기 전 백업' });
      }
    }
    const n = mergeLorebook(book, incoming, mode);
    S.sel.lore = null;
    touch(); after();
    toast(`엔트리 ${n}개를 가져왔어요.`);
  } catch (err) {
    toast(`가져오지 못했어요: ${err.message}`, 'err', 5000);
  }
}
