// 서재 — 프로젝트(카드) 바인더
import { h, btn, toast, ask, prompt, popMenu, fmtAgo, fmtDate, pickFiles, download } from '../ui/dom.js';
import { icon, APP_ICON } from '../ui/icons.js';
import { S, loadProjects, createProject, imageUrl, softDelete, restoreDeleted, hardDelete, saveProjectDirect } from '../store.js';
import { go, projectHash, rerender } from '../ui/nav.js';
import { analyzeFile, projectFromAnalysis, backupBlob, baseName } from '../porter.js';
import { uuid } from '../core/codec.js';
import { openSettings } from './settings.js';

const view = { q: '', sort: 'recent', trash: false };

export async function renderShelf(root) {
  await loadProjects();
  const live = S.projects.filter((p) => !p.deletedAt);
  const trashed = S.projects.filter((p) => p.deletedAt);

  const grid = h('div.binder', { role: 'list' });
  const fillGrid = () => {
    const q = view.q.trim().toLowerCase();
    let list = live.filter((p) => !q || [p.card.name, p.title, ...(p.card.tags || [])].join(' ').toLowerCase().includes(q));
    if (view.sort === 'name') list = list.sort((a, b) => (a.card.name || a.title).localeCompare(b.card.name || b.title, 'ko'));
    grid.replaceChildren(
      q ? null : newPocket(),
      ...list.map(pocket),
    );
    if (!list.length && q) grid.append(h('p', { style: { color: 'var(--muted)', gridColumn: '1/-1' } }, `"${view.q}"와 맞는 카드가 없어요.`));
  };

  const head = h('header.shelf-head', null,
    h('div.brand', null,
      h('img', { src: APP_ICON, alt: '' }),
      h('div', null, h('h1', null, '카드 아틀리에'), h('p', null, '실리태번 캐릭터 카드 제작실'))),
    h('div.actions', null,
      btn('가져오기', { ico: 'import', onClick: () => importFlow() }),
      btn('새 카드', { kind: 'primary', ico: 'plus', onClick: newCardFlow }),
      btn('', { kind: 'ghost', ico: 'settings', title: '설정', onClick: openSettings })));

  if (!live.length && !trashed.length) {
    root.replaceChildren(h('div.shelf-wrap', null, head, h('div.empty', null,
      h('div.glyph', null, icon('card', 'lg')),
      h('h3', null, '첫 카드를 꽂아볼까요?'),
      h('p', null, '새로 만들거나, 실리태번에서 내보낸 카드 PNG를 가져와 이어서 작업할 수 있어요. 파일을 이 창에 끌어다 놓아도 돼요.'),
      h('div.row', null,
        btn('카드 PNG 가져오기', { ico: 'import', onClick: () => importFlow() }),
        btn('새 카드 만들기', { kind: 'primary', ico: 'plus', onClick: newCardFlow })))));
    return;
  }

  const search = h('input.input', { type: 'search', placeholder: '이름이나 태그로 찾기', value: view.q, 'aria-label': '카드 검색' });
  search.addEventListener('input', () => { view.q = search.value; fillGrid(); });
  const sortSeg = h('div.seg', { role: 'group', 'aria-label': '정렬' });
  const drawSort = () => sortSeg.replaceChildren(
    ...[['recent', '최근 수정'], ['name', '이름순']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(view.sort === v), onclick: () => { view.sort = v; drawSort(); fillGrid(); } }, l)));
  drawSort();

  const tools = h('div.shelf-tools', null,
    h('div.search', null, icon('search', 'sm'), search),
    sortSeg,
    trashed.length ? btn(`휴지통 ${trashed.length}`, { kind: view.trash ? 'soft' : 'ghost', ico: 'trash', size: 'sm', onClick: () => { view.trash = !view.trash; rerender(); } }) : null);

  fillGrid();
  root.replaceChildren(h('div.shelf-wrap', null, head, tools,
    view.trash && trashed.length ? trashSection(trashed) : null,
    grid));
}

function newPocket() {
  return h('button.pocket.new', { type: 'button', onclick: newCardFlow, role: 'listitem' },
    h('div.toploader', null, h('div.new-inner', null, h('span.plus', null, icon('plus', 'lg')), '새 카드')),
    h('div.pocket-info', null, h('span.pocket-name', { style: { color: 'var(--muted)' } }, ' ')));
}

function pocket(p) {
  const face = h('div.face', null, h('div.monogram', null, h('span', null, [...(p.card.name || p.title || '?')][0])));
  if (p.imageId) imageUrl(p.imageId).then((url) => { if (url) face.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy' })); });
  const loreN = p.lorebook?.entries?.length || 0;
  const regexN = p.regex?.length || 0;
  const menuBtn = btn('', {
    size: 'sm', ico: 'more', title: '더 보기',
    onClick: (e) => {
      e.stopPropagation();
      popMenu(menuBtn, [
        { label: '열기', ico: 'card', onClick: () => go(projectHash(p.id)) },
        { label: '복제', ico: 'copy', onClick: () => duplicate(p) },
        { label: '백업 파일로 저장', ico: 'backup', onClick: async () => download(await backupBlob(p), `${baseName(p, '{name}')}.catl`) },
        '-',
        { label: '휴지통으로', ico: 'trash', danger: true, onClick: async () => { await softDelete(p); toast(`'${p.card.name || p.title}'을 휴지통으로 옮겼어요.`); rerender(); } },
      ]);
    },
  });
  const el = h('div.pocket', { role: 'listitem', tabindex: '0', 'aria-label': `${p.card.name || p.title || '이름 없는 카드'} 열기`, onclick: () => go(projectHash(p.id)), onkeydown: (e) => { if (e.key === 'Enter' && e.target === el) go(projectHash(p.id)); } },
    h('div.toploader', null, h('span.notch'), face),
    h('div.pocket-menu', null, menuBtn),
    h('div.pocket-info', null,
      h('span.pocket-name', null, p.card.name || p.title || '이름 없는 카드'),
      h('div.pocket-meta', null,
        h('span.pill.accent', null, `v${p.version}`),
        loreN ? h('span.pill', { title: '로어북 엔트리' }, icon('book', 'sm'), loreN) : null,
        regexN ? h('span.pill', { title: '정규식' }, icon('regex', 'sm'), regexN) : null,
        h('span', { title: fmtDate(p.updatedAt) }, fmtAgo(p.updatedAt)))));
  tilt(el.querySelector('.toploader'), el);
  return el;
}

/** 포인터를 따라 살짝 기우는 탑로더 (사용자 동작에만 반응) */
export function tilt(card, area = card) {
  if (!matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  area.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--tilt-y', `${(x - 0.5) * 9}deg`);
    card.style.setProperty('--tilt-x', `${(0.5 - y) * 7}deg`);
    card.style.setProperty('--gx', `${x * 100}%`);
    card.style.setProperty('--gy', `${y * 100}%`);
  });
  area.addEventListener('pointerleave', () => {
    for (const k of ['--tilt-x', '--tilt-y', '--gx', '--gy']) card.style.removeProperty(k);
  });
}

function trashSection(trashed) {
  return h('section.trash-list', { 'aria-label': '휴지통' },
    h('p', { style: { margin: '0 0 6px', color: 'var(--muted)', fontSize: '13px' } }, '휴지통의 카드는 직접 비우기 전까지 남아 있어요.'),
    trashed.map((p) => h('div.trash-row', null,
      h('div', null, h('div.name', null, p.card.name || p.title || '이름 없는 카드'), h('div.when', null, `${fmtDate(p.deletedAt)}에 삭제`)),
      h('div.row', null,
        btn('되살리기', { size: 'sm', kind: 'soft', ico: 'restore', onClick: async () => { await restoreDeleted(p); toast('되살렸어요.'); rerender(); } }),
        btn('완전히 삭제', {
          size: 'sm', kind: 'danger', ico: 'trash', onClick: async () => {
            if (await ask({ title: '완전히 삭제할까요?', message: `'${p.card.name || p.title}'과 버전 기록이 모두 사라지고 되돌릴 수 없어요. 필요하면 먼저 백업 파일로 저장해두세요.`, ok: '완전히 삭제', danger: true })) {
              await hardDelete(p); toast('삭제했어요.'); rerender();
            }
          },
        })))));
}

async function newCardFlow() {
  const name = await prompt({ title: '새 카드', label: '캐릭터 이름', placeholder: '나중에 바꿀 수 있어요', ok: '만들기' });
  if (name == null) return;
  const p = await createProject({ title: name.trim() });
  p.card.name = name.trim();
  p.lorebook.name = name.trim();
  await saveProjectDirect(p);
  go(projectHash(p.id));
}

async function duplicate(p) {
  const copy = structuredClone(p);
  copy.id = uuid();
  copy.title = `${p.title || p.card.name} 사본`;
  copy.card.name = `${p.card.name} 사본`;
  copy.createdAt = copy.updatedAt = Date.now();
  await saveProjectDirect(copy);
  toast('복제했어요.');
  rerender();
}

export async function importFlow(files) {
  files = files || await pickFiles({ accept: '.png,.json,.catl,image/*', multiple: true });
  if (!files.length) return;
  const made = [];
  const fails = [];
  for (const f of files) {
    try {
      const a = await analyzeFile(f);
      const r = await projectFromAnalysis(a);
      made.push(r.project || r);
    } catch (err) {
      console.error(err);
      fails.push(`${f.name}: ${err.message}`);
    }
  }
  if (fails.length) toast(`가져오지 못한 파일 ${fails.length}개 — ${fails[0]}`, 'err', 5000);
  if (made.length === 1) { toast('가져왔어요.'); go(projectHash(made[0].id)); }
  else if (made.length > 1) { toast(`${made.length}개를 가져왔어요.`); rerender(); }
}
