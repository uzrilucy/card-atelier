// ─────────────────────────────────────────────────────────────
//  카드 아틀리에 — 앱 셸 · 라우팅 · 전역 단축키
// ─────────────────────────────────────────────────────────────
import { h, btn, toast, $, ask } from './ui/dom.js';
import { icon, APP_ICON } from './ui/icons.js';
import { S, on, loadSettings, openProject, closeProject, flush, reloadFromDisk, requestPersist } from './store.js';
import { setHooks, go, projectHash } from './ui/nav.js';
import { renderShelf, importFlow } from './views/shelf.js';
import { renderCard } from './views/card.js';
import { renderLore } from './views/lore.js';
import { renderRegex } from './views/regex.js';
import { renderNotes } from './views/notes.js';
import { renderVersions } from './views/versions.js';
import { renderExport } from './views/export.js';
import { openSettings } from './views/settings.js';
import { openManual } from './ui/manual.js';
import { analyzeFile, mergeLorebook, mergeRegex, projectFromAnalysis } from './porter.js';
import { ingestImage, touch } from './store.js';

const TABS = [
  { id: 'card', label: '카드', ico: 'card', render: renderCard },
  { id: 'lore', label: '로어북', ico: 'book', render: renderLore, count: () => S.P.lorebook.entries.length },
  { id: 'regex', label: '정규식', ico: 'regex', render: renderRegex, count: () => S.P.regex.length },
  { id: 'notes', label: '메모', ico: 'note', render: renderNotes, count: () => S.P.notes.length },
  { id: 'versions', label: '버전', ico: 'history', render: renderVersions },
  { id: 'export', label: '내보내기', ico: 'export', render: renderExport },
];

const app = document.getElementById('app');
let shellEls = null;
let renderSeq = 0;

function parseHash() {
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/([a-z]+))?/);
  if (m) return { view: 'project', id: decodeURIComponent(m[1]), tab: TABS.some((t) => t.id === m[2]) ? m[2] : 'card' };
  return { view: 'shelf' };
}

async function render() {
  const seq = ++renderSeq;
  const r = parseHash();
  if (r.view === 'shelf') {
    await flush();
    closeProject();
    shellEls = null;
    document.title = '카드 아틀리에';
    await renderShelf(app);
    return;
  }
  if (!S.P || S.P.id !== r.id) {
    const p = await openProject(r.id);
    if (seq !== renderSeq) return;
    if (!p) { toast('카드를 찾을 수 없어요.', 'err'); go('#/'); return; }
  }
  if (S.P.deletedAt) { toast('휴지통에 있는 카드예요. 서재에서 되살린 뒤 열어주세요.', 'warn', 4000); go('#/'); return; }
  S.tab = r.tab;
  buildShell();
  const tab = TABS.find((t) => t.id === r.tab);
  const content = shellEls.content;
  content.className = `content${r.tab === 'lore' || r.tab === 'regex' ? ' wide' : ''}`;
  await tab.render(content);
  if (seq !== renderSeq) return;
  chrome();
  window.scrollTo({ top: 0 });
}

function buildShell() {
  if (shellEls) return;
  const rail = h('nav.rail', { 'aria-label': '카드 편집 메뉴' });
  const nav = h('div.rail-nav');
  const titleH = h('h1');
  const ver = h('span.ver');
  const badge = h('span.save-badge', { role: 'status', 'aria-live': 'polite' }, h('span.dot'), h('span.lbl'));
  const banner = h('div.banner', { hidden: true },
    icon('alert'), h('span', null, '다른 창에서 이 카드를 수정했어요. 덮어쓰지 않도록 이 창의 저장을 멈췄어요.'),
    btn('최신 내용 불러오기', { size: 'sm', kind: 'primary', onClick: async () => { await reloadFromDisk(); render(); } }));
  const content = h('section.content');
  rail.append(
    h('button.rail-home', { type: 'button', title: '서재로', 'aria-label': '서재로', onclick: () => go('#/') }, h('img', { src: APP_ICON, alt: '' })),
    nav,
    h('div.rail-spacer'),
    h('button.rail-btn.rail-extra', { type: 'button', onclick: openSettings }, icon('settings'), '설정'));
  const top = h('header.topbar', null,
    btn('', { kind: 'ghost', ico: 'back', title: '서재로', attrs: { class: 'btn ghost icon back' }, onClick: () => go('#/') }),
    h('div.top-title', null, titleH, ver),
    h('div.top-actions', null, btn('', { kind: 'ghost', ico: 'book', title: '사용 매뉴얼', onClick: openManual }), badge));
  app.replaceChildren(h('div.shell', null, rail, h('div.main', null, top, banner, content)));
  shellEls = { nav, titleH, ver, badge, banner, content };
}

/** 상단 제목·탭 수·저장 상태 갱신 */
function chrome() {
  if (!shellEls || !S.P) return;
  const { nav, titleH, ver, banner } = shellEls;
  const name = S.P.card.name || S.P.title || '이름 없는 카드';
  titleH.textContent = name;
  ver.textContent = `v${S.P.version}`;
  document.title = `${name} — 카드 아틀리에`;
  nav.replaceChildren(...TABS.map((t) => {
    const n = t.count?.();
    return h('button.rail-btn', {
      type: 'button', 'aria-current': S.tab === t.id ? 'page' : null,
      onclick: () => go(projectHash(S.P.id, t.id)),
    }, icon(t.ico), t.label, n ? h('span.count', null, n > 999 ? '999+' : n) : null);
  }));
  banner.hidden = !S.stale;
  drawBadge();
}

function drawBadge() {
  if (!shellEls) return;
  const { badge } = shellEls;
  badge.dataset.state = S.save;
  const text = { saved: '저장됨', dirty: '저장 대기', saving: '저장 중', error: '저장 실패', stale: '저장 멈춤' }[S.save] || '';
  badge.querySelector('.lbl').textContent = text;
  badge.title = S.save === 'error' ? `저장하지 못했어요: ${S.saveErr}` : S.save === 'saved' ? '이 기기에 자동 저장됐어요' : text;
}

setHooks({ render, chrome });
on('save', (state) => {
  drawBadge();
  if (state === 'error') toast(`저장하지 못했어요: ${S.saveErr}`, 'err', 6000);
});
on('stale', () => { if (shellEls) shellEls.banner.hidden = false; });
on('reloaded', () => { if (S.P) render(); });
on('list-changed', () => { if (parseHash().view === 'shelf') render(); });

window.addEventListener('hashchange', render);

/* ── 전역 단축키 ── */
document.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (!S.P) return;
    if (S.stale) { toast('다른 창의 변경 때문에 저장을 멈췄어요. 위의 버튼으로 최신 내용을 불러오세요.', 'warn', 4000); return; }
    S.save = S.save === 'saved' ? 'dirty' : S.save;
    await flush();
    toast('저장했어요.');
  }
});

/* ── 창을 떠날 때 즉시 저장 ── */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', () => flush());
window.addEventListener('beforeunload', (e) => {
  if (S.save === 'dirty' || S.save === 'saving') { flush(); e.preventDefault(); e.returnValue = ''; }
});

/* ── 파일 끌어다 놓기 ── */
let dragDepth = 0;
let hint = null;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  if (!hint) {
    hint = h('div.drop-hint', null, h('div', null, S.P ? '여기에 놓아 이 카드에 가져오기' : '여기에 놓아 서재로 가져오기',
      h('small', null, S.P ? '이미지, 월드인포 JSON, 정규식 JSON' : '카드 PNG, 카드·월드인포·정규식 JSON, 백업(.catl)')));
    document.body.append(hint);
  }
});
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { hint?.remove(); hint = null; } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
// 캡처 단계에서 안내 레이어부터 걷어냄 (이미지 칸 같은 하위 요소가 drop을 가로채도 남지 않게)
window.addEventListener('drop', () => { dragDepth = 0; hint?.remove(); hint = null; }, true);
window.addEventListener('drop', async (e) => {
  if (!hasFiles(e) || e.defaultPrevented) return;
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  if (!S.P) { importFlow(files); return; }
  for (const f of files) await dropIntoProject(f);
});

async function dropIntoProject(f) {
  try {
    const a = await analyzeFile(f);
    const P = S.P;
    if (a.kind === 'image') {
      if (await ask({ title: '카드 이미지로 쓸까요?', message: `'${f.name}'을 이 카드의 이미지로 바꿔요.`, ok: '바꾸기' })) {
        P.imageId = (await ingestImage(a.imageBlob)).id; touch(); render(); toast('이미지를 바꿨어요.');
      }
    } else if (a.kind === 'world') {
      const n = mergeLorebook(P.lorebook, a.lorebook, 'append'); touch(); go(projectHash(P.id, 'lore')); render(); toast(`엔트리 ${n}개를 이어 붙였어요.`);
    } else if (a.kind === 'regex') {
      const n = mergeRegex(P.regex, a.regex); touch(); go(projectHash(P.id, 'regex')); render(); toast(`정규식 ${n}개를 추가했어요.`);
    } else if (a.kind === 'card' || a.kind === 'backup') {
      if (await ask({ title: '새 카드로 가져올까요?', message: `'${f.name}'은 다른 카드예요. 서재에 새 카드로 추가해요.`, ok: '새 카드로 추가' })) {
        const r = await projectFromAnalysis(a);
        toast('새 카드로 가져왔어요.');
        go(projectHash((r.project || r).id));
      }
    } else {
      toast(`${f.name}: ${a.error}`, 'err', 5000);
    }
  } catch (err) {
    toast(`${f.name}: ${err.message}`, 'err', 5000);
  }
}

/* ── 시작 ── */
(async function boot() {
  try {
    await loadSettings();
    requestPersist(); // 설치형(PWA)에서는 대부분 자동 허용
    await render();
  } catch (err) {
    console.error(err);
    app.replaceChildren(h('div.empty', null, h('h3', null, '앱을 열지 못했어요'), h('p', null, String(err?.message || err)),
      h('p', null, '사생활 보호(시크릿) 창에서는 저장소가 막혀 있을 수 있어요.')));
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            toast('새 버전이 준비됐어요. 앱을 다시 열면 적용돼요.', 'ok', 6000);
          }
        });
      });
    }).catch(() => {});
  }
})();
