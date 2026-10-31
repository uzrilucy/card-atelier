// 단일 파일 빌드: npm i esbuild 후 `node tools/build-single.mjs`
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({ entryPoints: [`${ROOT}/js/app.js`], bundle: true, format: 'iife', write: false, charset: 'utf8', target: 'es2020', minify: false, legalComments: 'none' });
let js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let css = fs.readFileSync(`${ROOT}/css/app.css`, 'utf8').replaceAll("url('../fonts/", "url('fonts/");
let html = fs.readFileSync(`${ROOT}/index.html`, 'utf8')
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace('<link rel="stylesheet" href="css/app.css">', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>', `<script>\n${js}\n</script>`);
// 아이콘 SVG도 인라인 (data URI)
const svg = fs.readFileSync(`${ROOT}/icons/icon.svg`, 'utf8');
const dataSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
html = html.replaceAll('href="icons/icon.svg"', `href="${dataSvg}"`);
html = html.replace(/<script>\n/, `<script>\nwindow.__CA_ICON__=${JSON.stringify(dataSvg)};\n`);
fs.writeFileSync(`${ROOT}/카드아틀리에_단일파일.html`, html, 'utf8');
console.log('bytes', Buffer.byteLength(html));
