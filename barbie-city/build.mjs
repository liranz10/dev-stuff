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
  // Page body for hosts that supply their own <html>/<head> wrapper (e.g. a claude.ai artifact).
  // Only the document head is rewritten: the script must stay byte-for-byte intact
  // (three.js shader code contains strings like "#include <metalnessmap_fragment>").
  const cut = html.indexOf('<style>');
  const head = html.slice(0, cut)
    .replace(/<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*/i, '')
    .replace(/<meta[^>]*>\s*/g, '')
    .replace(/<title>[^<]*<\/title>\s*/, '');
  const title = (html.match(/<title>[^<]*<\/title>/) || [''])[0];
  const body = html.slice(cut).replace('</head>\n<body>\n', '').replace(/<\/body>\s*<\/html>\s*$/, '');
  writeFileSync('dist/embed.html', `${title}\n${head}${body}`);
  console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}

if (watch) {
  const ctx = await esbuild.context({ entryPoints: ['src/main.js'], bundle: true, write: false, plugins: [{ name: 'rebuild', setup(b) { b.onEnd(() => build().catch(e => console.error(e.message))); } }] });
  await ctx.watch();
  console.log('watching…');
} else {
  await build();
}
