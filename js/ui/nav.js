// 화면 전환 · 공용 갱신 훅 (순환 import 방지용 얇은 계층)
const hooks = { render: () => {}, chrome: () => {} };
export function setHooks(h) { Object.assign(hooks, h); }
export const rerender = () => hooks.render();
export const refreshChrome = () => hooks.chrome();
export function go(hash) {
  if (location.hash === hash) hooks.render();
  else location.hash = hash;
}
export const projectHash = (id, tab = 'card') => `#/p/${id}/${tab}`;
