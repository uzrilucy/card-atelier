// 아이콘 세트 — 24×24, 1.7 stroke. 직접 그린 단순 라인 아이콘.
const P = {
  card: '<rect x="5" y="2.8" width="14" height="18.4" rx="2.2"/><path d="M8.5 15.5c.9-1.6 2.1-2.4 3.5-2.4s2.6.8 3.5 2.4"/><circle cx="12" cy="9.6" r="2.3"/>',
  book: '<path d="M4.5 5.2c0-1.2 1-2.2 2.2-2.2H19.5v15H6.7c-1.2 0-2.2 1-2.2 2.2V5.2Z"/><path d="M4.5 20.2c0 .5.4.8.9.8H19.5"/><path d="M9 8h6.5M9 11.5h4"/>',
  regex: '<path d="M7.5 4c-2 2.2-3 4.9-3 8s1 5.8 3 8"/><path d="M16.5 4c2 2.2 3 4.9 3 8s-1 5.8-3 8"/><path d="M12 7.5v6M9.4 9l5.2 3M14.6 9 9.4 12"/><circle cx="12" cy="17" r=".9" fill="currentColor"/>',
  note: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h8.2L19 7.3v12.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15Z"/><path d="M14.5 3v4.5H19"/><path d="M8.5 12h7M8.5 15.5h5"/>',
  history: '<path d="M3.8 12a8.2 8.2 0 1 0 2.4-5.8"/><path d="M3.5 3.8v3.9h3.9"/><path d="M12 8v4.3l2.8 1.8"/>',
  export: '<path d="M12 3.5v11"/><path d="m7.8 7.7 4.2-4.2 4.2 4.2"/><path d="M5 13.5v4.8A1.7 1.7 0 0 0 6.7 20h10.6a1.7 1.7 0 0 0 1.7-1.7v-4.8"/>',
  import: '<path d="M12 14.5v-11"/><path d="m7.8 10.3 4.2 4.2 4.2-4.2"/><path d="M5 13.5v4.8A1.7 1.7 0 0 0 6.7 20h10.6a1.7 1.7 0 0 0 1.7-1.7v-4.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7"/><path d="M6.5 6.5l.9 12.2A1.8 1.8 0 0 0 9.2 20.4h5.6a1.8 1.8 0 0 0 1.8-1.7l.9-12.2"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6A2 2 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  up: '<path d="m6.5 14.5 5.5-5.5 5.5 5.5"/>',
  down: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 8.5v4.5"/><circle cx="12" cy="16.3" r=".9" fill="currentColor" stroke="none"/><path d="M10.3 4.2 2.9 17.3A2 2 0 0 0 4.6 20.3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="10" r="1.7"/><path d="m20.5 16-4.8-4.8L6 19.5"/>',
  crop: '<path d="M6.5 2.5v13.7c0 .7.6 1.3 1.3 1.3H21.5"/><path d="M2.5 6.5h13.7c.7 0 1.3.6 1.3 1.3V21.5"/>',
  expand: '<path d="M14.5 4h5.5v5.5"/><path d="M20 4l-6.3 6.3"/><path d="M9.5 20H4v-5.5"/><path d="M4 20l6.3-6.3"/>',
  restore: '<path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8"/><path d="M20.5 3.8v3.9h-3.9"/>',
  compare: '<path d="M8 4v16"/><path d="M16 4v16"/><path d="M4 8h4M4 12h4M16 12h4M16 16h4"/>',
  zip: '<path d="M5.5 4.5A1.5 1.5 0 0 1 7 3h10a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 17 21H7a1.5 1.5 0 0 1-1.5-1.5v-15Z"/><path d="M12 3v2m0 2v2m0 2v2"/><rect x="10.5" y="13" width="3" height="3.6" rx=".8"/>',
  json: '<path d="M8 4c-1.7 0-2.5.8-2.5 2.5v2.4c0 1.2-.6 2.1-2 2.6 1.4.5 2 1.4 2 2.6v2.4C5.5 18.2 6.3 20 8 20"/><path d="M16 4c1.7 0 2.5.8 2.5 2.5v2.4c0 1.2.6 2.1 2 2.6-1.4.5-2 1.4-2 2.6v2.4c0 1.7-.8 3.5-2.5 3.5"/>',
  backup: '<path d="M7 18.5A4.5 4.5 0 0 1 6.4 9.6a6 6 0 0 1 11.6 1.3A3.8 3.8 0 0 1 17.5 18.5H7Z"/><path d="M12 11v5.5"/><path d="m9.5 13.5 2.5-2.5 2.5 2.5"/>',
  pin: '<path d="M14.6 3.6 20.4 9.4l-3.2 1.3-3.3 3.3.6 4.1-1.5 1.5-3.4-3.4-4.6 4.6M9.6 10.7 6.1 7.2l1.5-1.5 4.1.6 3.3-3.3"/>',
  index: '<path d="M8 6h11M8 12h11M8 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 3.5c.6 3.8 2.7 5.9 6.5 6.5-3.8.6-5.9 2.7-6.5 6.5-.6-3.8-2.7-5.9-6.5-6.5 3.8-.6 5.9-2.7 6.5-6.5Z"/><path d="M18.5 15.5c.3 1.6 1.1 2.4 2.5 2.6-1.4.3-2.2 1.1-2.5 2.6-.3-1.5-1.1-2.3-2.5-2.6 1.4-.2 2.2-1 2.5-2.6Z"/>',
  share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4"/>',
  minify: '<path d="M4 7h16M4 12h10M4 17h6"/><path d="m17 14 3 3-3 3"/>',
  save: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h9.4L20 7.1v11.4a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 18.5v-14Z"/><path d="M8 3v5h7V3"/><rect x="8" y="12.5" width="8" height="7.5" rx="1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  code: '<path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5"/>',
  tag: '<path d="M3.5 12.4V4.9c0-.8.6-1.4 1.4-1.4h7.5l8.1 8.1a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0l-8-8.2Z"/><circle cx="8" cy="8" r="1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
};

export function icon(name, cls = '') {
  const span = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  span.setAttribute('viewBox', '0 0 24 24');
  span.setAttribute('class', `i ${cls}`.trim());
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = P[name] || P.info;
  return span;
}

/** 앱 로고 경로 — 단일 파일 빌드에서는 인라인 데이터로 대체 */
export const APP_ICON = (typeof window !== 'undefined' && window.__CA_ICON__) || 'icons/icon.svg';
