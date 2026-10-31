// 카드 편집 화면
import { h, btn, textField, inputField, selectField, chipInput, toggle, toast, ask, pickFiles } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { S, touch, imageUrl, imageRecord, ingestImage, listSnapshots } from '../store.js';
import { estimateTokens } from '../core/spec.js';
import { openFocusEditor } from './common.js';
import { refreshChrome } from '../ui/nav.js';
import { tilt } from './shelf.js';
import { changelogMarkdown } from '../porter.js';

const openState = JSON.parse(sessionStorage.getItem('ca-groups') || '{}');
let greetIdx = 0;

function group(key, title, metaFn, body, defaultOpen = true) {
  const d = h('details.group', { open: (openState[key] ?? defaultOpen) || null });
  const meta = h('span.sum-meta');
  const updMeta = () => { meta.textContent = metaFn ? metaFn() : ''; };
  d.addEventListener('toggle', () => { openState[key] = d.open; sessionStorage.setItem('ca-groups', JSON.stringify(openState)); });
  d.append(h('summary', null, h('h3', null, title), meta, h('span.chev', null, icon('chev', 'sm'))), h('div.group-body', null, body));
  d._upd = updMeta;
  updMeta();
  return d;
}

export function renderCard(root) {
  const P = S.P;
  const c = P.card;
  const groups = [];
  const onAny = () => { groups.forEach((g) => g._upd()); updTokens(); };
  const set = (k, after) => (v) => { c[k] = v; touch(); after?.(v); onAny(); };
  const tf = (k, label, extra = {}) => textField({ label, get: () => c[k], set: set(k), onExpand: openFocusEditor, id: `f-${k}`, ...extra });

  /* ── 왼쪽: 이미지 + 토큰 요약 ── */
  const face = h('div.face');
  const dim = h('div.image-dim');
  const card = h('div.toploader', null, h('span.notch'), face);
  const drawImage = async () => {
    const url = await imageUrl(P.imageId);
    face.replaceChildren(url ? h('img', { src: url, alt: `${c.name} 카드 이미지` }) : h('div.monogram', null, h('span', null, [...(c.name || '?')][0])));
    const rec = await imageRecord(P.imageId);
    dim.textContent = rec ? `${rec.w} × ${rec.h}px${rec.w && Math.abs(rec.w / rec.h - 2 / 3) > 0.02 ? '  2:3 비율이 아니에요' : ''}` : '이미지가 없으면 이름으로 표지를 만들어 넣어요';
    rmBtn.hidden = !P.imageId;
    cropBtn.hidden = !P.imageId;
  };
  const setImage = async (blob, crop = false) => {
    try {
      const { id } = await ingestImage(blob, { crop });
      P.imageId = id; touch(); await drawImage(); refreshChrome();
      toast(crop ? '2:3 비율로 잘랐어요.' : '이미지를 넣었어요.');
    } catch (err) { toast(`이미지를 읽지 못했어요: ${err.message}`, 'err'); }
  };
  const rmBtn = btn('', { size: 'sm', ico: 'trash', title: '이미지 빼기', kind: 'ghost', onClick: async () => {
    if (await ask({ title: '이미지를 뺄까요?', message: '버전 기록에 남은 이미지는 그대로 보관돼요.', ok: '빼기' })) { P.imageId = null; touch(); drawImage(); refreshChrome(); }
  } });
  const cropBtn = btn('2:3 자르기', { size: 'sm', ico: 'crop', title: '가운데 기준으로 2:3 비율로 자르기', onClick: async () => {
    const rec = await imageRecord(P.imageId); if (rec) setImage(rec.blob, true);
  } });
  const well = h('div.image-well', null, card);
  well.addEventListener('dragover', (e) => { if ([...e.dataTransfer.items].some((i) => i.type.startsWith('image/'))) { e.preventDefault(); e.stopPropagation(); well.classList.add('drag'); } });
  well.addEventListener('dragleave', () => well.classList.remove('drag'));
  well.addEventListener('drop', (e) => {
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    well.classList.remove('drag');
    if (f) { e.preventDefault(); e.stopPropagation(); setImage(f); }
  });
  tilt(card, well);
  drawImage();

  const tokTotal = h('strong');
  const bar = h('div.ts-bar');
  const legend = h('div.ts-legend');
  const SEG = [
    ['설명', () => c.description, 'var(--accent)'],
    ['성격', () => c.personality, 'var(--ok)'],
    ['시나리오', () => c.scenario, 'var(--warn)'],
    ['예시 대화', () => c.mes_example, 'var(--danger)'],
    ['캐릭터 노트', () => c.depth_prompt?.prompt, 'var(--text-2)'],
    ['상시 로어북', () => P.lorebook.entries.filter((e) => e.constant && !e.disable).map((e) => e.content).join('\n'), 'var(--faint)'],
  ];
  let tokTimer;
  const updTokens = () => {
    clearTimeout(tokTimer);
    tokTimer = setTimeout(() => {
      const vals = SEG.map(([l, f, col]) => [l, estimateTokens(f() || ''), col]);
      const total = vals.reduce((s, v) => s + v[1], 0);
      tokTotal.textContent = total.toLocaleString();
      bar.replaceChildren(...vals.filter((v) => v[1]).map(([l, n, col]) => h('i', { title: `${l} ${n}`, style: { width: `${(n / (total || 1)) * 100}%`, background: col } })));
      legend.replaceChildren(...vals.flatMap(([l, n, col]) => [h('span', null, h('i', { style: { background: col } }), l), h('span', null, n.toLocaleString())]));
    }, 120);
  };
  updTokens();

  const side = h('aside.card-side', null,
    well,
    h('div', null,
      h('div.image-actions', null,
        btn(P.imageId ? '이미지 바꾸기' : '이미지 넣기', { size: 'sm', ico: 'image', kind: 'soft', onClick: async () => { const [f] = await pickFiles({ accept: 'image/*' }); if (f) setImage(f); } }),
        cropBtn, rmBtn),
      dim),
    h('div.panel.token-summary', null,
      h('div.ts-head', null, tokTotal, h('span', null, '토큰  매 요청에 들어가는 양')),
      bar, legend,
      h('p.ts-note', null, '추정치예요. 모델과 토크나이저마다 조금씩 달라요.')));

  /* ── 오른쪽: 필드 묶음 ── */
  const nameF = inputField({ label: '이름', id: 'f-name', get: () => c.name, set: set('name', () => refreshChrome()), placeholder: '{{char}}로 불릴 이름' });
  const basics = h('div', null,
    h('div.grid-2', null,
      nameF,
      inputField({ label: '닉네임', hint: 'V3', id: 'f-nick', get: () => c.nickname, set: set('nickname'), placeholder: '비우면 이름을 써요' }),
      inputField({ label: '제작자', id: 'f-creator', get: () => c.creator, set: set('creator') }),
      inputField({ label: '캐릭터 버전', id: 'f-cver', get: () => c.character_version, set: set('character_version'), placeholder: '1.0.0' })),
    h('div.field', null, h('div.field-head', null, h('label.field-label', { for: 'f-tags' }, '태그'), h('span.field-hint', null, 'Enter나 쉼표로 추가')),
      chipInput({ id: 'f-tags', label: '태그', get: () => c.tags, set: set('tags') })),
    h('div.grid-2', { style: { marginTop: '18px', alignItems: 'end' } },
      talkField(c, set),
      h('div.field', null, toggle({ label: '즐겨찾기로 표시', get: () => c.fav, set: set('fav') }))));

  const defs = h('div', null,
    tf('description', '설명', { rows: 8, help: '캐릭터의 외모·배경·말투 등 핵심 정의. 매 요청마다 들어가요.' }),
    tf('personality', '성격 요약', { rows: 3 }),
    tf('scenario', '시나리오', { rows: 3 }));

  /* 인사말 탭 */
  const greetBox = h('div');
  const drawGreet = () => {
    const all = [c.first_mes, ...c.alternate_greetings];
    if (greetIdx >= all.length) greetIdx = all.length - 1;
    const tabs = h('div.greet-tabs', { role: 'tablist', 'aria-label': '인사말' },
      all.map((_, i) => h('button.greet-tab', {
        type: 'button', role: 'tab', 'aria-selected': String(i === greetIdx),
        onclick: () => { greetIdx = i; drawGreet(); },
      }, i === 0 ? '첫 메시지' : `대체 ${i}`)),
      btn('추가', { size: 'sm', kind: 'ghost', ico: 'plus', onClick: () => { c.alternate_greetings.push(''); greetIdx = c.alternate_greetings.length; touch(); drawGreet(); onAny(); greetBox.querySelector('textarea')?.focus(); } }));
    const isFirst = greetIdx === 0;
    const field = textField({
      label: isFirst ? '첫 메시지' : `대체 인사말 ${greetIdx}`,
      id: 'f-greet',
      rows: 7,
      get: () => (isFirst ? c.first_mes : c.alternate_greetings[greetIdx - 1]),
      set: (v) => { if (isFirst) c.first_mes = v; else c.alternate_greetings[greetIdx - 1] = v; touch(); onAny(); },
      onExpand: openFocusEditor,
      help: isFirst ? '채팅을 시작하면 처음 보이는 메시지예요. 대체 인사말은 스와이프로 고를 수 있어요.' : null,
    });
    const tools = isFirst ? null : h('div.greet-tools', null,
      btn('첫 메시지로 올리기', { size: 'sm', ico: 'up', onClick: () => {
        const i = greetIdx - 1; [c.first_mes, c.alternate_greetings[i]] = [c.alternate_greetings[i], c.first_mes]; greetIdx = 0; touch(); drawGreet();
      } }),
      btn('', { size: 'sm', ico: 'back', title: '앞으로', disabled: greetIdx <= 1, onClick: () => {
        const i = greetIdx - 1; const a = c.alternate_greetings; [a[i - 1], a[i]] = [a[i], a[i - 1]]; greetIdx--; touch(); drawGreet();
      } }),
      btn('', { size: 'sm', ico: 'back', title: '뒤로', disabled: greetIdx >= c.alternate_greetings.length, attrs: { style: 'transform:scaleX(-1)' }, onClick: () => {
        const i = greetIdx - 1; const a = c.alternate_greetings; [a[i + 1], a[i]] = [a[i], a[i + 1]]; greetIdx++; touch(); drawGreet();
      } }),
      btn('삭제', { size: 'sm', kind: 'danger', ico: 'trash', onClick: async () => {
        const v = c.alternate_greetings[greetIdx - 1];
        if (v.trim() && !(await ask({ title: '이 인사말을 지울까요?', message: '버전 기록에서 되살릴 수 있어요.', ok: '지우기', danger: true }))) return;
        c.alternate_greetings.splice(greetIdx - 1, 1); greetIdx = Math.max(0, greetIdx - 1); touch(); drawGreet(); onAny();
      } }));
    greetBox.replaceChildren(tabs, field, tools);
  };
  drawGreet();

  const groupGreetBox = h('div');
  const drawGroupGreet = () => {
    groupGreetBox.replaceChildren(
      ...c.group_only_greetings.map((g, i) => h('div', { style: { marginTop: i ? '14px' : 0 } },
        textField({ label: `그룹 인사말 ${i + 1}`, rows: 3, get: () => c.group_only_greetings[i], set: (v) => { c.group_only_greetings[i] = v; touch(); }, onExpand: openFocusEditor }),
        h('div.greet-tools', null, btn('삭제', { size: 'sm', kind: 'danger', ico: 'trash', onClick: () => { c.group_only_greetings.splice(i, 1); touch(); drawGroupGreet(); onAny(); } })))),
      h('div', { style: { marginTop: '10px' } }, btn('그룹 인사말 추가', { size: 'sm', kind: 'ghost', ico: 'plus', onClick: () => { c.group_only_greetings.push(''); touch(); drawGroupGreet(); onAny(); } })));
  };
  drawGroupGreet();

  const dp = c.depth_prompt;
  const note = h('div', null,
    textField({ label: '캐릭터 노트', id: 'f-dp', rows: 4, get: () => dp.prompt, set: (v) => { dp.prompt = v; touch(); onAny(); }, onExpand: openFocusEditor, help: '대화 기록 사이 지정한 깊이에 끼워 넣는 짧은 지시문이에요. 말투 고정·잊으면 안 되는 규칙에 좋아요.' }),
    h('div.grid-2', { style: { marginTop: '14px' } },
      inputField({ label: '깊이', type: 'number', min: 0, step: 1, get: () => dp.depth, set: (v) => { dp.depth = v; touch(); onAny(); } }),
      selectField({ label: '역할', numeric: false, options: [{ v: 'system', label: '시스템' }, { v: 'user', label: '사용자' }, { v: 'assistant', label: 'AI' }], get: () => dp.role, set: (v) => { dp.role = v; touch(); } })));

  const overrides = h('div', null,
    tf('system_prompt', '메인 프롬프트 오버라이드', { rows: 4, help: '비워두면 실리 기본 프롬프트를 써요. {{original}}을 넣으면 기본 프롬프트를 그 자리에 포함해요.' }),
    tf('post_history_instructions', '탈옥(PHI) 오버라이드', { rows: 4, help: '대화 기록 뒤에 들어가는 지시문이에요. {{original}} 사용 가능.' }));

  const notesField = tf('creator_notes', '제작자 노트', { rows: 6, help: '실리 캐릭터 정보에서 사용자에게 보이는 소개글이에요. AI에게는 전달되지 않아요.' });
  const creatorNotes = h('div', null, notesField,
    h('div.greet-tools', null, btn('업데이트 기록 넣기', {
      size: 'sm', ico: 'history', title: '버전 기록을 제작자 노트 끝에 넣거나 갱신해요',
      onClick: async () => {
        const log = changelogMarkdown(await listSnapshots(P.id));
        if (!log) { toast('먼저 버전 탭에서 버전을 하나 이상 저장해주세요.', 'warn', 3600); return; }
        c.creator_notes = insertChangelog(c.creator_notes, log);
        touch(); notesField._refresh(); onAny();
        toast('제작자 노트에 업데이트 기록을 넣었어요.');
      },
    })));

  const exampleField = tf('mes_example', '예시 대화', { rows: 8, help: '<START>로 대화 묶음을 나눠요. 예시는 말투 참고용이라고 시스템 프롬프트에 함께 적어두면 AI가 문장을 그대로 베끼는 걸 줄일 수 있어요.' });

  const T = (s) => estimateTokens(s || '').toLocaleString();
  groups.push(
    group('basic', '기본 정보', () => `${c.tags.length ? `태그 ${c.tags.length}` : ''}`, basics),
    group('defs', '캐릭터 정의', () => `${T(c.description + c.personality + c.scenario)} 토큰`, defs),
    group('greet', '인사말', () => `${1 + c.alternate_greetings.length}개`, greetBox),
    group('example', '예시 대화', () => `${T(c.mes_example)} 토큰`, exampleField),
    group('note', '캐릭터 노트', () => (dp.prompt ? `깊이 ${dp.depth}` : '비어 있음'), note, !!dp.prompt),
    group('override', '프롬프트 오버라이드', () => [c.system_prompt && '메인', c.post_history_instructions && 'PHI'].filter(Boolean).join(', ') || '사용 안 함', overrides, !!(c.system_prompt || c.post_history_instructions)),
    group('groupgreet', '그룹 전용 인사말', () => `${c.group_only_greetings.length}개`, groupGreetBox, c.group_only_greetings.length > 0),
    group('creator', '제작자 노트', () => (c.creator_notes ? `${[...c.creator_notes].length.toLocaleString()}자` : '비어 있음'), creatorNotes),
  );

  root.replaceChildren(h('div.card-layout', null, side, h('div.panel', null, groups)));
  if (!c.name) requestAnimationFrame(() => document.getElementById('f-name')?.focus());
}

function talkField(c, set) {
  const out = h('span.field-meta');
  const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: c.talkativeness ?? 0.5, style: { width: '100%', accentColor: 'var(--accent)' }, 'aria-label': '수다 정도' });
  const upd = () => { out.textContent = `${Math.round(r.value * 100)}%`; };
  r.addEventListener('input', () => { set('talkativeness')(Number(r.value)); upd(); });
  upd();
  return h('div.field', null, h('div.field-head', null, h('span.field-label', null, '수다 정도'), h('span.field-hint', null, '그룹 채팅에서 끼어드는 빈도'), out), r);
}

const MARK_A = '<!--card-atelier:changelog-->';
const MARK_B = '<!--/card-atelier:changelog-->';
function insertChangelog(notes, log) {
  const block = `${MARK_A}\n${log.trim()}\n${MARK_B}`;
  const s = String(notes || '');
  const a = s.indexOf(MARK_A), b = s.indexOf(MARK_B);
  if (a >= 0 && b > a) return s.slice(0, a) + block + s.slice(b + MARK_B.length);
  return (s.trimEnd() ? `${s.trimEnd()}\n\n` : '') + block;
}
