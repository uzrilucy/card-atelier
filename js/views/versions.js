// 버전 기록
import { h, btn, toggle, textField, toast, ask, modal, fmtDate, fmtAgo, download } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { S, touch, flush, createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot, on } from '../store.js';
import { projectDiff } from '../core/diff.js';
import { diffView } from './common.js';
import { rerender, refreshChrome } from '../ui/nav.js';
import { buildCardPng, changelogMarkdown, baseName } from '../porter.js';

const ui = { showAuto: false, bumpCard: true, note: '' };

export function bump(v, part) {
  const m = String(v || '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$/);
  if (!m) return v || '1.0.0';
  let [maj, min, pat] = [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)];
  if (part === 'major') { maj++; min = 0; pat = 0; } else if (part === 'minor') { min++; pat = 0; } else pat++;
  return `${maj}.${min}.${pat}`;
}

export async function renderVersions(root) {
  const P = S.P;
  await flush();
  const snaps = await listSnapshots(P.id);
  const manual = snaps.filter((s) => s.kind === 'manual');
  const latest = manual[0];

  /* ── 새 버전 저장 ── */
  const verInput = h('input.input', { value: latest ? bump(P.version, 'patch') : P.version, 'aria-label': '새 버전 번호', id: 'v-new' });
  const noteField = textField({ label: '바뀐 내용', id: 'v-note', rows: 5, tokens: false, get: () => ui.note, set: (v) => { ui.note = v; }, placeholder: '- 첫 메시지 분위기 수정\n- 로어북: 도깨비 터 엔트리 추가', help: '한 줄에 하나씩 적으면 업데이트 기록에 목록으로 들어가요.' });
  const save = async () => {
    const v = verInput.value.trim();
    if (!v) { toast('버전 번호를 적어주세요.', 'warn'); verInput.focus(); return; }
    if (manual.some((s) => s.version === v) && !(await ask({ title: `v${v}가 이미 있어요`, message: '같은 번호로 하나 더 저장할까요?', ok: '저장' }))) return;
    P.version = v;
    if (ui.bumpCard) P.card.character_version = v;
    touch();
    await flush();
    await createSnapshot('manual', { version: v, note: ui.note.trim() });
    ui.note = '';
    toast(`v${v}로 저장했어요.`);
    refreshChrome();
    rerender();
  };
  const form = h('div.panel.panel-pad', null,
    h('h3', { style: { margin: '0 0 4px', font: '700 18px/1.3 var(--font-name)' } }, '지금 상태를 버전으로 저장'),
    h('p.field-help', { style: { margin: '0 0 16px' } }, `현재 v${P.version}. 저장한 버전은 언제든 비교하고 되돌릴 수 있어요.`),
    h('div.field', null,
      h('div.field-head', null, h('label.field-label', { for: 'v-new' }, '새 버전')),
      h('div.row', { style: { alignItems: 'center', flexWrap: 'nowrap' } }, verInput),
      h('div.row', { style: { gap: '6px' } },
        ...[['patch', '작은 수정'], ['minor', '기능 추가'], ['major', '대규모 개편']].map(([k, l]) => btn(l, { size: 'sm', kind: 'ghost', onClick: () => { verInput.value = bump(P.version, k); } })))),
    h('div', { style: { marginTop: '16px' } }, noteField),
    h('div', { style: { marginTop: '12px' } }, toggle({ label: '카드의 캐릭터 버전도 같이 바꾸기', get: () => ui.bumpCard, set: (v) => { ui.bumpCard = v; } })),
    h('div', { style: { marginTop: '16px' } }, btn('버전 저장', { kind: 'primary', ico: 'save', onClick: save, attrs: { class: 'btn primary block' } })));

  const logTools = h('div.panel.panel-pad', null,
    h('h3', { style: { margin: '0 0 4px', font: '700 16px/1.3 var(--font-name)' } }, '업데이트 기록'),
    h('p.field-help', { style: { margin: '0 0 12px' } }, '저장한 버전들의 바뀐 내용을 마크다운으로 모아요. 배포글이나 제작자 노트에 붙이기 좋아요.'),
    h('div.row', { style: { gap: '8px' } },
      btn('복사', { size: 'sm', ico: 'copy', disabled: !manual.length, onClick: async () => {
        try { await navigator.clipboard.writeText(changelogMarkdown(snaps)); toast('업데이트 기록을 복사했어요.'); } catch { toast('클립보드에 접근할 수 없어요.', 'err'); }
      } })));

  /* ── 타임라인 ── */
  const tl = h('div.timeline');
  const diffNow = latest ? projectDiff(latest.data, P) : null;
  tl.append(h('div.tl-item.current', null,
    h('div.tl-dot', null, icon('sparkle', 'sm')),
    h('div.panel.tl-card', null,
      h('div.tl-top', null, h('span.tl-ver', null, '지금'), h('span.tl-when', null, `자동 저장 ${fmtAgo(P.updatedAt)}`)),
      h('p.tl-note', null, latest ? (diffNow.total ? `마지막 버전(v${latest.version}) 이후 ${diffNow.total}곳이 바뀌었어요.` : `마지막 버전(v${latest.version})과 같아요.`) : '아직 저장한 버전이 없어요. 왼쪽에서 첫 버전을 남겨보세요.'),
      latest && diffNow.total ? h('div.tl-actions', null, btn('바뀐 곳 보기', { size: 'sm', ico: 'compare', onClick: () => showDiff(latest.data, P, `v${latest.version} → 지금`) })) : null)));

  const autoCount = snaps.length - manual.length;
  for (const s of snaps) {
    if (s.kind === 'auto' && !ui.showAuto) continue;
    tl.append(snapItem(s, snaps));
  }
  if (autoCount) {
    tl.append(h('div.tl-auto-toggle', null, btn(ui.showAuto ? '자동 저장 지점 숨기기' : `자동 저장 지점 ${autoCount}개 보기`, {
      size: 'sm', kind: 'ghost', ico: 'history', onClick: () => { ui.showAuto = !ui.showAuto; rerender(); },
    })));
  }

  root.replaceChildren(
    h('div.page-head', null, h('div', null, h('h2', null, '버전 기록'), h('p', null, '수동으로 저장한 버전은 계속 남고, 자동 저장 지점은 최근 30개만 남아요.'))),
    h('div.versions', null, h('div', null, form, logTools), tl));
}

function snapItem(s, all) {
  const P = S.P;
  const isManual = s.kind === 'manual';
  const d = s.data;
  const prev = all.slice(all.indexOf(s) + 1).find((x) => x.kind === s.kind) || null;
  return h('div', { class: `tl-item ${s.kind}` },
    h('div.tl-dot', null, icon(isManual ? 'save' : 'history', 'sm')),
    h('div', { class: `tl-card ${isManual ? 'panel' : ''}` },
      h('div.tl-top', null,
        h('span.tl-ver', { style: isManual ? null : { fontSize: '14px', fontFamily: 'var(--font-ui)', fontWeight: 600 } }, isManual ? `v${s.version}` : s.label || '자동 저장 지점'),
        h('span.tl-when', { title: fmtDate(s.createdAt) }, `${fmtDate(s.createdAt)}`)),
      isManual && s.note ? h('p.tl-note', null, s.note) : null,
      isManual ? h('div.tl-stats', null,
        h('span.pill', null, icon('book', 'sm'), d.lorebook?.entries?.length || 0),
        h('span.pill', null, icon('regex', 'sm'), d.regex?.length || 0),
        h('span.pill', null, `인사말 ${1 + (d.card?.alternate_greetings?.length || 0)}`)) : null,
      h('div.tl-actions', null,
        btn('지금과 비교', { size: 'sm', ico: 'compare', onClick: () => showDiff(d, P, `${isManual ? `v${s.version}` : '자동 저장 지점'} → 지금`) }),
        isManual && prev ? btn('이전 버전과 비교', { size: 'sm', kind: 'ghost', onClick: () => showDiff(prev.data, d, `v${prev.version} → v${s.version}`) }) : null,
        btn('되돌리기', { size: 'sm', kind: 'ghost', ico: 'restore', onClick: async () => {
          if (!(await ask({ title: `${isManual ? `v${s.version}` : '이 지점'}으로 되돌릴까요?`, message: '지금 상태는 자동 저장 지점으로 먼저 남겨둬요. 언제든 다시 돌아올 수 있어요.', ok: '되돌리기' }))) return;
          await restoreSnapshot(s);
          toast('되돌렸어요.');
          refreshChrome(); rerender();
        } }),
        isManual ? btn('이 버전 PNG', { size: 'sm', kind: 'ghost', ico: 'export', onClick: async () => {
          const temp = { ...structuredClone(P), ...structuredClone(d) };
          const out = await buildCardPng(temp, temp.exportOptions);
          download(new Blob([out.bytes], { type: 'image/png' }), `${baseName(temp)}.png`);
        } }) : null,
        btn('', { size: 'sm', kind: 'danger', ico: 'trash', title: '이 기록 삭제', onClick: async () => {
          if (!(await ask({ title: '이 기록을 지울까요?', message: '지운 기록은 되살릴 수 없어요.', ok: '지우기', danger: true }))) return;
          await deleteSnapshot(s.id); rerender();
        } }))));
}

function showDiff(a, b, title) {
  modal({ title, size: 'wide', body: diffView(projectDiff(a, b)) });
}

// 다른 곳에서 스냅샷이 생기면 이 화면이 열려 있을 때만 갱신
on('snapshots', () => { if (S.tab === 'versions' && S.P) rerender(); });
