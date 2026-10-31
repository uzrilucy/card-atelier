// 정규식 공방
import { h, btn, textField, inputField, selectField, chipInput, toggle, segmented, toast, ask, popMenu, pickFiles, autosize } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { S, touch } from '../store.js';
import { REGEX_PLACEMENTS, REGEX_SUBST, newRegexScript, regexFromString, runRegex, minifyHtml } from '../core/spec.js';
import { openFocusEditor, emptyDetail, subHead, moveItem } from './common.js';
import { refreshChrome } from '../ui/nav.js';
import { analyzeFile, mergeRegex } from '../porter.js';
import { uuid } from '../core/codec.js';

const bench = { mode: 'single', view: 'preview', br: true };
const placeShort = (arr) => (arr || []).map((v) => REGEX_PLACEMENTS.find((p) => p.v === v)?.label.replace('(Reasoning)', '').trim() || v).join(', ') || '적용 위치 없음';

export function renderRegex(root) {
  const P = S.P;
  const split = h('div.split', { class: S.detail.regex ? 'show-detail' : '' });
  const list = h('div.list', { role: 'listbox', 'aria-label': '정규식 목록' });
  const detail = h('div.detail-pane.panel');

  const row = (r) => {
    const re = regexFromString(r.findRegex);
    const bad = !r.findRegex || !re || re.error;
    return h('button.item', {
      type: 'button', role: 'option', class: r.disabled ? 'off' : '', 'aria-selected': String(S.sel.regex === r.id), dataset: { id: r.id },
      onclick: () => { S.sel.regex = r.id; S.detail.regex = true; split.classList.add('show-detail'); markSel(); drawDetail(); },
    },
    h('span', { class: `mark ${r.disabled ? 'off' : 'regex'}` }),
    h('span.t', null, r.scriptName || '이름 없음'),
    h('span.n', null, bad ? h('span.pill.danger', null, '오류') : null),
    h('span.s', { style: { fontFamily: 'var(--font-code)', fontSize: '11.5px' } }, r.findRegex || '패턴 없음'));
  };
  const markSel = () => list.querySelectorAll('.item').forEach((el) => el.setAttribute('aria-selected', String(el.dataset.id === S.sel.regex)));
  const refreshRow = (id) => { const r = P.regex.find((x) => x.id === id); const old = list.querySelector(`.item[data-id="${CSS.escape(id)}"]`); if (r && old) old.replaceWith(row(r)); };
  const foot = h('div.list-foot');
  const drawList = () => {
    foot.replaceChildren(h('span', null, `정규식 ${P.regex.length}`), h('span', null, `사용 중 ${P.regex.filter((x) => !x.disabled).length}`));
    list.replaceChildren(...P.regex.map(row));
    if (!P.regex.length) list.append(h('p', { style: { padding: '18px 12px', color: 'var(--muted)', fontSize: '13.5px', margin: 0 } }, '아직 정규식이 없어요.'));
  };

  const addScript = () => {
    const r = newRegexScript({ scriptName: `정규식 ${P.regex.length + 1}` });
    P.regex.push(r);
    S.sel.regex = r.id; S.detail.regex = true; split.classList.add('show-detail');
    touch(); drawList(); drawDetail(); refreshChrome();
    requestAnimationFrame(() => detail.querySelector('.title-input')?.select());
  };

  const drawDetail = () => {
    const r = P.regex.find((x) => x.id === S.sel.regex);
    if (!r) {
      detail.replaceChildren(emptyDetail({
        ico: 'regex', title: P.regex.length ? '정규식을 고르세요' : '첫 정규식을 만들어볼까요?',
        text: '상태창 태그를 HTML로 바꾸거나, 출력 문구를 다듬는 규칙이에요. 아래 테스트 칸에서 결과를 바로 확인할 수 있어요.',
        action: btn('정규식 추가', { kind: 'primary', ico: 'plus', onClick: addScript }),
      }));
      return;
    }
    let benchTimer;
    const reBench = () => { clearTimeout(benchTimer); benchTimer = setTimeout(runBench, 140); };
    const upd = (k) => (v) => { r[k] = v; touch(); refreshRow(r.id); reBench(); };

    const title = h('input.title-input', { value: r.scriptName, placeholder: '정규식 이름', 'aria-label': '정규식 이름' });
    title.addEventListener('input', () => { r.scriptName = title.value; touch(); refreshRow(r.id); });

    // 찾을 정규식 + 실시간 검사
    const status = h('span.status-line');
    const findInp = h('input.input.code', { value: r.findRegex, placeholder: '/<SBST>([\\s\\S]*?)<\\/SBST>/g', spellcheck: 'false', id: 'rx-find' });
    const check = () => {
      const re = regexFromString(findInp.value);
      if (!findInp.value) { status.className = 'status-line idle'; status.replaceChildren('패턴을 입력하세요'); findInp.classList.remove('invalid'); return; }
      if (!re || re.error) { status.className = 'status-line err'; status.replaceChildren(icon('alert', 'sm'), re?.error?.replace('Invalid regular expression: ', '') || '해석할 수 없는 패턴'); findInp.classList.add('invalid'); return; }
      status.className = 'status-line ok';
      status.replaceChildren(icon('check', 'sm'), `올바른 패턴${re.flags ? `  플래그 ${re.flags}` : '  플래그 없음 (첫 번째만 바뀜)'}`);
      findInp.classList.remove('invalid');
    };
    findInp.addEventListener('input', () => { r.findRegex = findInp.value; touch(); refreshRow(r.id); check(); reBench(); });
    check();

    const repField = textField({ label: '바꿀 내용', id: 'rx-rep', rows: 6, mono: true, tokens: false, get: () => r.replaceString, set: (v) => { r.replaceString = v; touch(); reBench(); }, onExpand: openFocusEditor, help: '$1, $2… 는 캡처 그룹, {{match}}는 찾은 부분 전체예요.' });
    const placement = h('div.checks', null, REGEX_PLACEMENTS.map((p) => {
      const inp = h('input', { type: 'checkbox', checked: (r.placement || []).includes(p.v) });
      inp.addEventListener('change', () => {
        const set = new Set(r.placement || []);
        inp.checked ? set.add(p.v) : set.delete(p.v);
        r.placement = [...set].sort((a, b) => a - b); touch(); refreshRow(r.id); reBench();
      });
      return h('label.check', null, inp, h('span', null, p.label));
    }));

    // 테스트 벤치
    const sample = h('textarea.textarea.code', { rows: 7, spellcheck: 'false', placeholder: 'AI가 출력할 법한 문장을 붙여넣으세요.\n예) 본문…\n<SBST>\nDATE: Day 1\n</SBST>', 'aria-label': '테스트 입력' });
    sample.value = P.samples[r.id] ?? '';
    sample.addEventListener('input', () => { P.samples[r.id] = sample.value; touch(); reBench(); });
    autosize(sample);
    const countLine = h('span.status-line.idle');
    const frame = h('iframe.preview-frame', { sandbox: '', title: '미리보기', referrerpolicy: 'no-referrer' });
    const pre = h('pre');
    const outBox = h('div');
    const runBench = () => {
      const input = sample.value;
      const macros = { user: S.settings.previewUser || 'User', char: P.card.name || 'Char' };
      let text = input, err = null, count = 0;
      const chain = bench.mode === 'single' ? [r] : P.regex.filter((x) => !x.disabled && (x.placement || []).includes(2));
      for (const s of chain) {
        if (!s.findRegex) continue;
        const res = runRegex(s, text, macros);
        if (res.error) { if (s === r) err = res.error; continue; }
        text = res.output;
        if (s === r) count = res.count;
      }
      countLine.className = `status-line ${err ? 'err' : count ? 'ok' : 'idle'}`;
      countLine.replaceChildren(err ? `패턴 오류: ${err}` : input ? `${count}곳 바뀜${bench.mode === 'chain' ? `  정규식 ${chain.length}개 순서대로 적용` : ''}` : '테스트 문장을 넣어보세요');
      pre.textContent = text;
      const bodyHtml = bench.br ? text.replace(/\n/g, '<br>') : text;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches && S.settings.theme !== 'light' || S.settings.theme === 'dark';
      frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;font:15px/1.7 'Pretendard Variable',system-ui,'Malgun Gothic',sans-serif;background:${dark ? '#1b1a22' : '#ffffff'};color:${dark ? '#dcdae3' : '#222'};word-break:keep-all;overflow-wrap:anywhere}</style></head><body>${bodyHtml}</body></html>`;
      outBox.replaceChildren(bench.view === 'preview' ? frame : pre);
    };

    const benchBox = h('div', null,
      h('div.bench', null,
        h('div.field', null, h('div.field-head', null, h('span.field-label', null, '테스트 입력'), h('span.field-hint', null, '이 카드 안에만 저장돼요')), sample),
        h('div.bench-out', null,
          h('div.out-head', null,
            segmented({ label: '결과 보기', options: [{ v: 'preview', label: '미리보기', ico: 'eye' }, { v: 'raw', label: '결과 원문', ico: 'code' }], get: () => bench.view, set: (v) => { bench.view = v; runBench(); } }),
            segmented({ label: '적용 범위', options: [{ v: 'single', label: '이것만' }, { v: 'chain', label: '켜진 것 전부' }], get: () => bench.mode, set: (v) => { bench.mode = v; runBench(); } })),
          outBox,
          h('div.row', { style: { alignItems: 'center', justifyContent: 'space-between' } }, countLine,
            toggle({ label: '줄바꿈을 <br>로', get: () => bench.br, set: (v) => { bench.br = v; runBench(); } })))),
      h('p.field-help', { style: { marginTop: '10px' } }, '미리보기는 근사치예요. 실리의 마크다운 변환과 테마 CSS까지 똑같이 재현하진 않아요. 스크립트는 실행하지 않아요.'));

    const moreBtn = btn('', {
      size: 'sm', ico: 'more', title: '더 보기', onClick: () => popMenu(moreBtn, [
        { label: '복제', ico: 'copy', onClick: () => { const c = { ...structuredClone(r), id: uuid(), scriptName: `${r.scriptName} 사본` }; P.regex.splice(P.regex.indexOf(r) + 1, 0, c); S.sel.regex = c.id; touch(); drawList(); drawDetail(); refreshChrome(); } },
        { label: 'JSON 복사', ico: 'json', onClick: async () => { try { await navigator.clipboard.writeText(JSON.stringify(r, null, 4)); toast('JSON을 복사했어요.'); } catch { toast('클립보드에 접근할 수 없어요.', 'err'); } } },
        { label: '위로', ico: 'up', onClick: () => { if (moveItem(P.regex, P.regex.indexOf(r), -1)) { touch(); drawList(); } } },
        { label: '아래로', ico: 'down', onClick: () => { if (moveItem(P.regex, P.regex.indexOf(r), 1)) { touch(); drawList(); } } },
        '-',
        { label: '삭제', ico: 'trash', danger: true, onClick: async () => {
          if (!(await ask({ title: '정규식을 삭제할까요?', message: `'${r.scriptName}' — 버전 기록에서 되살릴 수 있어요.`, ok: '삭제', danger: true }))) return;
          P.regex.splice(P.regex.indexOf(r), 1); delete P.samples[r.id];
          S.sel.regex = null; S.detail.regex = false; split.classList.remove('show-detail');
          touch(); drawList(); drawDetail(); refreshChrome();
        } },
      ]),
    });

    detail.replaceChildren(
      h('div.detail-head', null,
        btn('', { kind: 'ghost', ico: 'back', title: '목록으로', attrs: { class: 'btn ghost icon detail-back' }, onClick: () => { S.detail.regex = false; split.classList.remove('show-detail'); } }),
        title,
        toggle({ label: '사용', get: () => !r.disabled, set: (v) => { r.disabled = !v; touch(); drawList(); reBench(); } }),
        moreBtn),
      h('div.detail-body', null,
        h('div.field', null, h('div.field-head', null, h('label.field-label', { for: 'rx-find' }, '찾을 정규식'), status), findInp),
        h('div', { style: { marginTop: '18px' } }, repField),
        h('div.greet-tools', null,
          btn('한 줄로 압축', { size: 'sm', ico: 'minify', title: '태그 사이 줄바꿈을 지워요. 실리 마크다운이 줄바꿈을 망가뜨리는 걸 막아줘요.', onClick: () => {
            const before = r.replaceString; r.replaceString = minifyHtml(before);
            if (before === r.replaceString) { toast('이미 한 줄이에요.', 'warn'); return; }
            repField._refresh(); touch(); reBench(); toast('한 줄로 압축했어요.');
          } })),
        h('div.field', { style: { marginTop: '18px' } }, h('div.field-head', null, h('label.field-label', { for: 'rx-trim' }, '잘라낼 문자열'), h('span.field-hint', null, '캡처 결과에서 지울 문자열')),
          chipInput({ id: 'rx-trim', label: '잘라낼 문자열', mono: true, get: () => r.trimStrings, set: upd('trimStrings') })),
        subHead('적용 위치'),
        placement,
        h('div.toggle-list', { style: { marginTop: '14px' } },
          toggle({ label: '화면 표시에만 적용 (채팅 기록 원문은 그대로)', get: () => r.markdownOnly, set: upd('markdownOnly') }),
          toggle({ label: '프롬프트에만 적용 (AI에게 보낼 때만)', get: () => r.promptOnly, set: upd('promptOnly') }),
          toggle({ label: '메시지를 편집할 때도 실행', get: () => r.runOnEdit, set: upd('runOnEdit') })),
        h('div.grid-3', { style: { marginTop: '16px' } },
          selectField({ label: '정규식 안 매크로', options: REGEX_SUBST, get: () => r.substituteRegex, set: upd('substituteRegex') }),
          inputField({ label: '최소 깊이', type: 'number', min: -1, step: 1, nullable: true, placeholder: '없음', get: () => r.minDepth, set: upd('minDepth') }),
          inputField({ label: '최대 깊이', type: 'number', min: 0, step: 1, nullable: true, placeholder: '없음', get: () => r.maxDepth, set: upd('maxDepth') })),
        subHead('테스트'),
        benchBox));
    runBench();
  };

  root.replaceChildren(
    h('div.page-head', null,
      h('div', null, h('h2', null, '정규식'), h('p', null, '카드에 함께 담기는 캐릭터 전용 정규식이에요. 위에서부터 순서대로 실행돼요.')),
      h('div.actions', null,
        btn('가져오기', { ico: 'import', onClick: importRegex }),
        btn('정규식 추가', { kind: 'primary', ico: 'plus', onClick: addScript }))),
    split);
  split.append(h('div.panel.list-pane', null, list, foot), detail);
  drawList();
  drawDetail();

  async function importRegex() {
    const files = await pickFiles({ accept: '.json,.png', multiple: true });
    let n = 0;
    for (const f of files) {
      try {
        const a = await analyzeFile(f);
        const incoming = a.kind === 'regex' ? a.regex : a.kind === 'card' ? a.parsed.regex : [];
        n += mergeRegex(P.regex, incoming);
      } catch (err) { toast(`${f.name}: ${err.message}`, 'err', 5000); }
    }
    if (n) { touch(); drawList(); refreshChrome(); toast(`정규식 ${n}개를 가져왔어요.`); }
    else if (files.length) toast('가져올 정규식이 없었어요.', 'warn');
  }
}

export { placeShort };
