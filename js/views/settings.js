// 설정 모달
import { h, modal, segmented, inputField, selectField, btn, toast, download } from '../ui/dom.js';
import { S, saveSettings, storageInfo, requestPersist, loadProjects } from '../store.js';
import { allBackupsZip } from '../porter.js';
import { APP_VERSION } from '../version.js';

const fmtBytes = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(1)}GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.round(n / 1e3)}KB`);

export async function openSettings() {
  const info = await storageInfo();
  const persistLine = h('p.field-help');
  const drawPersist = (ok) => {
    persistLine.replaceChildren(ok
      ? '저장 공간이 고정되어 있어요. 브라우저가 공간 정리를 해도 지워지지 않아요.'
      : '고정되지 않은 상태예요. 기기 공간이 부족하면 브라우저가 데이터를 정리할 수 있으니, 고정을 요청하고 백업도 가끔 받아두세요.');
  };
  drawPersist(info.persisted);

  const body = h('div', null,
    h('div.field', null, h('div.field-label', null, '화면 테마'),
      segmented({
        label: '화면 테마',
        options: [{ v: 'auto', label: '시스템' }, { v: 'dark', label: '어둡게' }, { v: 'light', label: '밝게' }],
        get: () => S.settings.theme,
        set: (v) => { S.settings.theme = v; saveSettings(); },
      })),
    inputField({
      label: '{{user}} 미리보기 이름', help: '정규식 테스트에서 {{user}} 자리에 넣을 이름이에요.',
      get: () => S.settings.previewUser, set: (v) => { S.settings.previewUser = v; saveSettings(); },
    }),
    selectField({
      label: '자동 저장 지점 간격', numeric: true,
      options: [{ v: 5, label: '5분마다' }, { v: 10, label: '10분마다' }, { v: 20, label: '20분마다' }, { v: 30, label: '30분마다' }],
      get: () => S.settings.autoSnapMin, set: (v) => { S.settings.autoSnapMin = v; saveSettings(); },
    }),
    h('div.field', null,
      h('div.field-head', null, h('span.field-label', null, '저장 공간'), h('span.field-meta', null, info.quota ? `${fmtBytes(info.usage)} 사용 중` : '')),
      persistLine,
      h('div.row', null,
        info.persisted ? null : btn('저장 공간 고정 요청', {
          size: 'sm', kind: 'soft', onClick: async () => {
            const ok = await requestPersist(); drawPersist(ok);
            toast(ok ? '저장 공간을 고정했어요.' : '브라우저가 요청을 거절했어요. 앱으로 설치하면 대부분 허용돼요.', ok ? 'ok' : 'warn', 4000);
          },
        }),
        btn('모든 카드 백업 받기', {
          size: 'sm', ico: 'backup', onClick: async () => {
            const list = (await loadProjects()).filter((p) => !p.deletedAt);
            if (!list.length) { toast('백업할 카드가 없어요.', 'warn'); return; }
            const d = new Date();
            download(await allBackupsZip(list), `카드아틀리에_전체백업_${d.toISOString().slice(0, 10)}.zip`);
            toast(`${list.length}개 카드를 백업했어요.`);
          },
        }))),
    h('p.field-help', { style: { marginTop: '22px' } }, `카드 아틀리에 ${APP_VERSION}  모든 데이터는 이 기기 안에만 저장돼요.`));

  modal({ title: '설정', body });
}
