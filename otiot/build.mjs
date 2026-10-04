// בונה קובץ אחד: dist/index.html (אתר מלא, עובד גם בלי אינטרנט) ו-dist/artifact.html (לתצוגה ב-claude.ai)
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const read = (p) => readFileSync(here + p, 'utf8');
const css = read('src/style.css');
const js = ['letters', 'art', 'engine', 'audio', 'app'].map((f) => read(`src/${f}.js`)).join('\n');
let html = read('index.html')
  .replace(/<!--STYLE-->[\s\S]*?<!--\/STYLE-->/, () => `<style>\n${css}</style>`)
  .replace(/<!--SCRIPTS-->[\s\S]*?<!--\/SCRIPTS-->/, () => `<script>\n${js}</script>`);
mkdirSync(here + 'dist', { recursive: true });
cpSync(here + 'public', here + 'dist', { recursive: true });
writeFileSync(here + 'dist/index.html', html);
// גרסת artifact: בלי doctype/head/body (המעטפת מוסיפה אותם), בלי service worker ובלי manifest
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800&family=Varela+Round&display=swap">';
const body = html.split('<body>')[1].split('</body>')[0].replace(/<script>\s*\/\/ עבודה בלי אינטרנט[\s\S]*?<\/script>/, '');
writeFileSync(here + 'dist/artifact.html', `<title>כפר האותיות</title>\n${fonts}\n<style>\n${css}</style>\n<script>document.documentElement.lang='he';document.documentElement.dir='rtl';</script>\n${body}`);
console.log('built', (html.length / 1024).toFixed(0) + 'KB');
