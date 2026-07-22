// Empacota src/game.js (Three.js + addons + jogo) num único oniria.html self-contained.
// Uso: node build.mjs   (requer: npm i three@0.160.0 esbuild)
import { build } from 'esbuild';
import fs from 'fs';

const result = await build({
  entryPoints: ['src/game.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  legalComments: 'none',
  target: ['chrome100','firefox100','safari15'],
  write: false,
});
const js = result.outputFiles[0].text;
const tpl = fs.readFileSync('oniria.template.html','utf8');
// NB: replacement passed as a function so `$` sequences in the bundle
// (e.g. `${`, `$'`) are inserted literally, not treated as replace patterns.
const html = tpl.replace('<!--BUNDLE-->', () => '<script>\n'+js+'\n</script>');
fs.writeFileSync('oniria.html', html);
console.log('oniria.html:', (html.length/1024/1024).toFixed(2), 'MB  (bundle', (js.length/1024/1024).toFixed(2), 'MB)');
