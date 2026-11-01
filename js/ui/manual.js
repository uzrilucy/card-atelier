// 자체 HTML 매뉴얼 — 편집 화면을 유지한 채 열기.
import { h, modal } from './dom.js';
import { S } from '../store.js';

export function openManual() {
  const frame = h('iframe.manual-frame', {
    title: '카드 아틀리에 사용 매뉴얼',
    sandbox: 'allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox',
  });
  const theme = S.settings.theme;
  if (window.__CA_MANUAL__) {
    frame.srcdoc = window.__CA_MANUAL__.replace('<html lang="ko">',
      `<html lang="ko"${theme === 'light' || theme === 'dark' ? ` data-theme="${theme}"` : ''}>`);
  } else {
    frame.src = `manual.html${theme === 'light' || theme === 'dark' ? `?theme=${theme}` : ''}`;
  }
  const view = modal({ title: '사용 매뉴얼', size: 'full manual-modal', body: frame });
  // iframe 내부에 포커스가 있을 때도 Esc로 닫기.
  const escape = (e) => {
    if (e.source === frame.contentWindow && e.data === 'card-atelier:close-manual') view.close();
  };
  window.addEventListener('message', escape);
  new MutationObserver((_, observer) => {
    if (!view.el.isConnected) { window.removeEventListener('message', escape); observer.disconnect(); }
  }).observe(document.body, { childList: true });
}
