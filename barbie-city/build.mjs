// Bundles the game into ONE self-contained HTML file: dist/index.html
// (three.js included, so it also works offline / from a double-click).
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');

async function build() {
  const out = await esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    legalComments: 'none',
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync('index.html', 'utf8').replace('<!--GAME-->', () => `<script>${js}</script>`);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}

if (watch) {
  const ctx = await esbuild.context({ entryPoints: ['src/main.js'], bundle: true, write: false, plugins: [{ name: 'rebuild', setup(b) { b.onEnd(() => build().catch(e => console.error(e.message))); } }] });
  await ctx.watch();
  console.log('watching…');
} else {
  await build();
}
