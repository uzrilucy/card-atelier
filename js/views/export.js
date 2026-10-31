// 내보내기
import { h, btn, toggle, toast, download, shareFile, canShareFiles } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { S, touch, flush, imageUrl, imageRecord } from '../store.js';
import { regexFromString, estimateTokens } from '../core/spec.js';
import { buildCardPng, worldBlob, regexFiles, cardJsonBlob, bundleZip, backupBlob, baseName } from '../porter.js';
import { makeZip } from '../core/zip.js';
import { safeFileName } from '../core/codec.js';
import { tilt } from './shelf.js';
import { go, projectHash } from '../ui/nav.js';

/** 내보내기 전 점검 목록 */
export async function checks(P) {
  const out = [];
  const c = P.card;
  if (!c.name.trim()) out.push({ lv: 'error', t: '이름이 비어 있어요', d: '카드 탭에서 캐릭터 이름을 적어주세요.', tab: 'card' });
  if (!c.first_mes.trim()) out.push({ lv: 'warn', t: '첫 메시지가 비어 있어요', d: '채팅을 시작해도 아무 말도 나오지 않아요.', tab: 'card' });
  if (!c.description.trim()) out.push({ lv: 'warn', t: '설명이 비어 있어요', d: '로어북에만 정의했다면 괜찮아요.', tab: 'card' });
  const rec = await imageRecord(P.imageId);
  if (!rec) out.push({ lv: 'info', t: '이미지가 없어요', d: '이름으로 만든 표지를 대신 넣어요.', tab: 'card' });
  else if (Math.abs(rec.w / rec.h - 2 / 3) > 0.02) out.push({ lv: 'info', t: `이미지 비율 ${rec.w}×${rec.h}`, d: '실리 목록에서는 2:3으로 잘려 보여요.', tab: 'card' });

  const badRx = P.regex.filter((r) => { const re = regexFromString(r.findRegex); return !r.findRegex || !re || re.error; });
  if (badRx.length) out.push({ lv: 'error', t: `정규식 ${badRx.length}개에 패턴 오류`, d: badRx.map((r) => r.scriptName).join(', '), tab: 'regex' });
  const noPlace = P.regex.filter((r) => !r.disabled && !(r.placement || []).length);
  if (noPlace.length) out.push({ lv: 'warn', t: `적용 위치가 없는 정규식 ${noPlace.length}개`, d: '아무 데도 적용되지 않아요.', tab: 'regex' });

  const E = P.lorebook.entries;
  const deaf = E.filter((e) => !e.disable && !e.constant && !e.vectorized && !(e.key || []).some((k) => k.trim()));
  if (deaf.length) out.push({ lv: 'warn', t: `키워드 없는 엔트리 ${deaf.length}개`, d: `발동할 수 없어요: ${deaf.slice(0, 3).map((e) => e.comment || `#${e.uid}`).join(', ')}${deaf.length > 3 ? ' 외' : ''}`, tab: 'lore' });
  const blank = E.filter((e) => !e.disable && !e.content.trim());
  if (blank.length) out.push({ lv: 'warn', t: `내용 없는 엔트리 ${blank.length}개`, d: blank.slice(0, 3).map((e) => e.comment || `#${e.uid}`).join(', '), tab: 'lore' });
  if (E.length && !P.exportOptions.embedLorebook) out.push({ lv: 'info', t: '로어북을 카드에 넣지 않아요', d: '월드인포 JSON을 따로 가져와 연결해야 해요.' });

  const total = estimateTokens(c.description + c.personality + c.scenario + c.mes_example);
  if (total > 6000) out.push({ lv: 'info', t: `카드 본문 약 ${total.toLocaleString()} 토큰`, d: '꽤 길어요. 일부를 로어북으로 옮기면 여유가 생겨요.', tab: 'card' });
  if (!out.some((x) => x.lv === 'error' || x.lv === 'warn')) out.unshift({ lv: 'ok', t: '내보낼 준비가 됐어요', d: '막히는 문제가 없어요.' });
  return out;
}

export async function renderExport(root) {
  const P = S.P;
  await flush();
  const opts = P.exportOptions;

  /* 왼쪽: 미리보기 + 점검 */
  const face = h('div.face');
  const url = await imageUrl(P.imageId);
  face.append(url ? h('img', { src: url, alt: '' }) : h('div.monogram', null, h('span', null, [...(P.card.name || '?')][0])));
  const card = h('div.toploader', null, h('span.notch'), face);
  tilt(card);
  const list = h('div.panel.checklist');
  const drawChecks = async () => {
    const items = await checks(P);
    list.replaceChildren(...items.map((x) => h('div', { class: `check-item ${x.lv}` },
      h('span.ci-icon', null, icon({ ok: 'check', warn: 'alert', error: 'alert', info: 'info' }[x.lv], 'sm')),
      h('div', null, h('b', null, x.t), x.d ? h('small', null, x.d) : null,
        x.tab ? h('button', { type: 'button', class: 'btn ghost sm', style: { marginTop: '4px', marginLeft: '-10px' }, onclick: () => go(projectHash(P.id, x.tab)) }, '고치러 가기') : null))));
  };
  drawChecks();

  /* 오른쪽: 내보내기 목록 */
  const fileName = h('input.input', { value: opts.fileNamePattern, 'aria-label': '파일 이름 형식', id: 'x-fn' });
  const fnPreview = h('span.field-hint');
  const updFn = () => { fnPreview.textContent = `${baseName(P)}.png`; };
  fileName.addEventListener('input', () => { opts.fileNamePattern = fileName.value || '{name}_v{version}'; touch(); updFn(); });
  updFn();
  const verify = h('div');
  const shareable = canShareFiles();

  const pngRow = h('div.panel.out-row.hero', null,
    h('div.oi', null, icon('card', 'lg')),
    h('div', null,
      h('h4', null, '캐릭터 카드 PNG'),
      h('p', null, '실리태번 캐릭터 가져오기에 바로 넣는 파일이에요. V2와 V3 규격을 함께 담아요.'),
      h('div.out-opts', null,
        toggle({ label: `로어북을 카드에 넣기 (엔트리 ${P.lorebook.entries.length})`, get: () => opts.embedLorebook, set: (v) => { opts.embedLorebook = v; touch(); drawChecks(); } }),
        toggle({ label: `정규식을 카드에 넣기 (${P.regex.length}개)`, get: () => opts.embedRegex, set: (v) => { opts.embedRegex = v; touch(); } }),
        h('div.field', { style: { marginTop: '8px' } },
          h('div.field-head', null, h('label.field-label', { for: 'x-fn' }, '파일 이름'), h('span.field-hint', null, '{name} {version} {date}'), h('span.field-meta', null, fnPreview)),
          fileName)),
      verify),
    h('div.acts', null,
      shareable ? btn('공유', { ico: 'share', onClick: () => exportPng(true) }) : null,
      btn('PNG 내보내기', { kind: 'primary', ico: 'export', onClick: () => exportPng(false) })));

  async function exportPng(share) {
    try {
      const out = await buildCardPng(P);
      const blob = new Blob([out.bytes], { type: 'image/png' });
      const name = `${baseName(P)}.png`;
      verify.replaceChildren(out.verified
        ? h('span.verify.ok', null, icon('check', 'sm'), '다시 읽어서 원본과 글자 하나까지 같은지 확인했어요')
        : h('span.verify.err', null, icon('alert', 'sm'), `검증 실패: ${out.verifyError}`));
      if (!out.verified) { toast('검증에 실패해서 내보내지 않았어요.', 'err', 5000); return; }
      if (share && await shareFile(blob, name).catch(() => false)) return;
      download(blob, name);
      toast(out.usedPlaceholder ? '이름 표지로 카드를 만들었어요.' : '카드 PNG를 내보냈어요.');
    } catch (err) {
      console.error(err);
      toast(`내보내지 못했어요: ${err.message}`, 'err', 5000);
    }
  }

  const simpleRow = (ico, title, desc, actions) => h('div.panel.out-row', null, h('div.oi', null, icon(ico, 'lg')), h('div', null, h('h4', null, title), h('p', null, desc)), h('div.acts', null, actions));
  const bookName = safeFileName(P.lorebook.name || P.card.name, 'lorebook');

  const rows = h('div.out-list', null,
    pngRow,
    simpleRow('book', '월드인포 JSON', P.lorebook.entries.length ? `실리 월드인포 화면의 가져오기로 넣는 파일이에요. 엔트리 ${P.lorebook.entries.length}개.` : '로어북 엔트리가 없어요.',
      btn('JSON 내보내기', { disabled: !P.lorebook.entries.length, ico: 'export', onClick: () => { download(worldBlob(P), `${bookName}.json`); toast('월드인포를 내보냈어요.'); } })),
    simpleRow('regex', '정규식 JSON', P.regex.length ? `실리 정규식 확장에서 가져오기로 넣어요. ${P.regex.length > 1 ? '여러 개라 ZIP으로 묶어요.' : ''}` : '정규식이 없어요.',
      btn('JSON 내보내기', { disabled: !P.regex.length, ico: 'export', onClick: () => {
        const files = regexFiles(P);
        if (files.length === 1) download(new Blob([files[0].data], { type: 'application/json;charset=utf-8' }), files[0].name);
        else download(makeZip(files), `${baseName(P)}_정규식.zip`);
        toast('정규식을 내보냈어요.');
      } })),
    simpleRow('json', '카드 JSON', '이미지 없이 데이터만 담은 카드예요. 다른 도구로 옮기거나 확인할 때 써요.', [
      btn('V2', { size: 'sm', onClick: () => download(cardJsonBlob(P, 'v2'), `${baseName(P)}.json`) }),
      btn('V3', { size: 'sm', onClick: () => download(cardJsonBlob(P, 'v3'), `${baseName(P)}_v3.json`) })]),
    simpleRow('zip', '전체 묶음 ZIP', '카드 PNG, 월드인포, 정규식, 업데이트 기록, 제작 메모를 한 번에 받아요. 배포용 보관에 좋아요.',
      btn('ZIP 내보내기', { ico: 'export', onClick: async () => {
        const z = await bundleZip(P);
        if (!z.verified) { toast('카드 검증에 실패했어요.', 'err'); return; }
        download(z.blob, z.name); toast('전체 묶음을 내보냈어요.');
      } })),
    simpleRow('backup', '프로젝트 백업', 'PC와 휴대폰 사이에서 작업을 옮길 때 쓰는 파일(.catl)이에요. 버전 기록과 메모까지 모두 담겨요. 다른 기기의 서재에서 가져오기로 열면 돼요.', [
      shareable ? btn('공유', { ico: 'share', onClick: async () => { const b = await backupBlob(P); if (!(await shareFile(b, `${baseName(P, '{name}')}.catl`).catch(() => false))) download(b, `${baseName(P, '{name}')}.catl`); } }) : null,
      btn('백업 받기', { ico: 'backup', onClick: async () => { download(await backupBlob(P), `${baseName(P, '{name}')}.catl`); toast('백업 파일을 받았어요.'); } })]));

  root.replaceChildren(
    h('div.page-head', null, h('div', null, h('h2', null, '내보내기'), h('p', null, '여기서 만든 파일만 실리에 넣으세요. 실리에서 직접 고친 내용은 이 앱에 반영되지 않아요.'))),
    h('div.export-layout', null,
      h('div', { style: { display: 'grid', gap: '16px' } }, h('div', { style: { maxWidth: '240px', width: '100%', margin: '0 auto' } }, card), list),
      rows));
}
