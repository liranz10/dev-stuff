// Builds js/world.js: a small world map (Natural Earth 1:110m, via the world-atlas package)
// with each country's Hebrew name and flag, so the game knows which country the plane is over.
//   cd tools && npm i --no-save world-atlas@2 topojson-client@3 && node make-world.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { feature } = require('topojson-client');
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'));

// id (ISO 3166 numeric) -> [Hebrew name, ISO alpha-2 for the flag emoji]
const HE = {
  242: ['פיג\'י', 'FJ'], 834: ['טנזניה', 'TZ'], 732: ['סהרה המערבית', 'EH'], 124: ['קנדה', 'CA'], 840: ['ארצות הברית', 'US'],
  398: ['קזחסטן', 'KZ'], 860: ['אוזבקיסטן', 'UZ'], 598: ['פפואה גינאה החדשה', 'PG'], 360: ['אינדונזיה', 'ID'], 32: ['ארגנטינה', 'AR'],
  152: ['צ\'ילה', 'CL'], 180: ['קונגו', 'CD'], 706: ['סומליה', 'SO'], 404: ['קניה', 'KE'], 729: ['סודן', 'SD'], 148: ['צ\'אד', 'TD'],
  332: ['האיטי', 'HT'], 214: ['הרפובליקה הדומיניקנית', 'DO'], 643: ['רוסיה', 'RU'], 44: ['איי בהאמה', 'BS'], 238: ['איי פוקלנד', 'FK'],
  578: ['נורווגיה', 'NO'], 304: ['גרינלנד', 'GL'], 626: ['טימור', 'TL'], 710: ['דרום אפריקה', 'ZA'], 426: ['לסוטו', 'LS'],
  484: ['מקסיקו', 'MX'], 858: ['אורוגוואי', 'UY'], 76: ['ברזיל', 'BR'], 68: ['בוליביה', 'BO'], 604: ['פרו', 'PE'], 170: ['קולומביה', 'CO'],
  591: ['פנמה', 'PA'], 188: ['קוסטה ריקה', 'CR'], 558: ['ניקרגואה', 'NI'], 340: ['הונדורס', 'HN'], 222: ['אל סלוודור', 'SV'],
  320: ['גואטמלה', 'GT'], 84: ['בליז', 'BZ'], 862: ['ונצואלה', 'VE'], 328: ['גיאנה', 'GY'], 740: ['סורינאם', 'SR'], 250: ['צרפת', 'FR'],
  218: ['אקוודור', 'EC'], 630: ['פוארטו ריקו', 'PR'], 388: ['ג\'מייקה', 'JM'], 192: ['קובה', 'CU'], 716: ['זימבבואה', 'ZW'],
  72: ['בוטסואנה', 'BW'], 516: ['נמיביה', 'NA'], 686: ['סנגל', 'SN'], 466: ['מאלי', 'ML'], 478: ['מאוריטניה', 'MR'], 204: ['בנין', 'BJ'],
  562: ['ניז\'ר', 'NE'], 566: ['ניגריה', 'NG'], 120: ['קמרון', 'CM'], 768: ['טוגו', 'TG'], 288: ['גאנה', 'GH'], 384: ['חוף השנהב', 'CI'],
  324: ['גינאה', 'GN'], 624: ['גינאה ביסאו', 'GW'], 430: ['ליבריה', 'LR'], 694: ['סיירה לאון', 'SL'], 854: ['בורקינה פאסו', 'BF'],
  140: ['הרפובליקה המרכז אפריקאית', 'CF'], 178: ['קונגו', 'CG'], 266: ['גבון', 'GA'], 226: ['גינאה המשוונית', 'GQ'], 894: ['זמביה', 'ZM'],
  454: ['מלאווי', 'MW'], 508: ['מוזמביק', 'MZ'], 748: ['אסוואטיני', 'SZ'], 24: ['אנגולה', 'AO'], 108: ['בורונדי', 'BI'],
  376: ['ישראל', 'IL'], 422: ['לבנון', 'LB'], 450: ['מדגסקר', 'MG'], 270: ['גמביה', 'GM'], 788: ['תוניסיה', 'TN'],
  12: ['אלג\'יריה', 'DZ'], 400: ['ירדן', 'JO'], 784: ['איחוד האמירויות', 'AE'], 634: ['קטאר', 'QA'], 414: ['כווית', 'KW'], 368: ['עיראק', 'IQ'],
  512: ['עומאן', 'OM'], 548: ['ונואטו', 'VU'], 116: ['קמבודיה', 'KH'], 764: ['תאילנד', 'TH'], 418: ['לאוס', 'LA'], 104: ['מיאנמר', 'MM'],
  704: ['וייטנאם', 'VN'], 408: ['קוריאה הצפונית', 'KP'], 410: ['קוריאה הדרומית', 'KR'], 496: ['מונגוליה', 'MN'], 356: ['הודו', 'IN'],
  50: ['בנגלדש', 'BD'], 64: ['בהוטן', 'BT'], 524: ['נפאל', 'NP'], 586: ['פקיסטן', 'PK'], 4: ['אפגניסטן', 'AF'], 762: ['טג\'יקיסטן', 'TJ'],
  417: ['קירגיזסטן', 'KG'], 795: ['טורקמניסטן', 'TM'], 364: ['איראן', 'IR'], 760: ['סוריה', 'SY'], 51: ['ארמניה', 'AM'], 752: ['שוודיה', 'SE'],
  112: ['בלארוס', 'BY'], 804: ['אוקראינה', 'UA'], 616: ['פולין', 'PL'], 40: ['אוסטריה', 'AT'], 348: ['הונגריה', 'HU'], 498: ['מולדובה', 'MD'],
  642: ['רומניה', 'RO'], 440: ['ליטא', 'LT'], 428: ['לטביה', 'LV'], 233: ['אסטוניה', 'EE'], 276: ['גרמניה', 'DE'], 100: ['בולגריה', 'BG'],
  300: ['יוון', 'GR'], 792: ['טורקיה', 'TR'], 8: ['אלבניה', 'AL'], 191: ['קרואטיה', 'HR'], 756: ['שווייץ', 'CH'], 442: ['לוקסמבורג', 'LU'],
  56: ['בלגיה', 'BE'], 528: ['הולנד', 'NL'], 620: ['פורטוגל', 'PT'], 724: ['ספרד', 'ES'], 372: ['אירלנד', 'IE'], 540: ['קלדוניה החדשה', 'NC'],
  90: ['איי שלמה', 'SB'], 554: ['ניו זילנד', 'NZ'], 36: ['אוסטרליה', 'AU'], 144: ['סרי לנקה', 'LK'], 156: ['סין', 'CN'], 158: ['טייוואן', 'TW'],
  380: ['איטליה', 'IT'], 208: ['דנמרק', 'DK'], 826: ['בריטניה', 'GB'], 352: ['איסלנד', 'IS'], 31: ['אזרבייג\'ן', 'AZ'], 268: ['גאורגיה', 'GE'],
  608: ['הפיליפינים', 'PH'], 458: ['מלזיה', 'MY'], 96: ['ברוניי', 'BN'], 705: ['סלובניה', 'SI'], 246: ['פינלנד', 'FI'], 703: ['סלובקיה', 'SK'],
  203: ['צ\'כיה', 'CZ'], 232: ['אריתריאה', 'ER'], 392: ['יפן', 'JP'], 600: ['פרגוואי', 'PY'], 887: ['תימן', 'YE'], 682: ['ערב הסעודית', 'SA'],
  196: ['קפריסין', 'CY'], 504: ['מרוקו', 'MA'], 818: ['מצרים', 'EG'], 434: ['לוב', 'LY'], 231: ['אתיופיה', 'ET'], 262: ['ג\'יבוטי', 'DJ'],
  800: ['אוגנדה', 'UG'], 646: ['רואנדה', 'RW'], 70: ['בוסניה', 'BA'], 807: ['מקדוניה', 'MK'], 688: ['סרביה', 'RS'], 499: ['מונטנגרו', 'ME'],
  780: ['טרינידד', 'TT'], 728: ['דרום סודן', 'SS'],
};
const flag = (cc) => String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));

const fc = feature(topo, topo.objects.countries);
const r1 = (x) => Math.round(x * 10) / 10;
const out = [];
for (const f of fc.features) {
  const name = f.properties.name;
  if (name === 'Antarctica' || name === 'Fr. S. Antarctic Lands') continue;
  const id = name === 'N. Cyprus' ? 196 : f.id == null ? 0 : Number(f.id);
  const he = HE[id];
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  let best = null, bestA = 0;
  const b = [180, 90, -180, -90];
  for (const poly of polys) {
    for (let k = 0; k < poly.length; k++) {
      const flat = [];
      for (const [x, y] of poly[k]) {
        const X = r1(x), Y = r1(y);
        if (flat.length && flat[flat.length - 2] === X && flat[flat.length - 1] === Y) continue;
        flat.push(X, Y);
        b[0] = Math.min(b[0], X); b[1] = Math.min(b[1], Y); b[2] = Math.max(b[2], X); b[3] = Math.max(b[3], Y);
      }
      if (flat.length < 6) continue;
      rings.push(flat);
      if (k === 0) {
        // area and centroid of the outer ring: the flag goes on the biggest piece of land
        let a = 0, cx = 0, cy = 0;
        for (let i = 0; i < flat.length; i += 2) {
          const j = (i + 2) % flat.length;
          const c = flat[i] * flat[j + 1] - flat[j] * flat[i + 1];
          a += c; cx += (flat[i] + flat[j]) * c; cy += (flat[i + 1] + flat[j + 1]) * c;
        }
        if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [r1(cx / (3 * a)), r1(cy / (3 * a))]; }
      }
    }
  }
  out.push({ he: he ? he[0] : '', f: he ? flag(he[1]) : '', b, c: best, p: rings });
}
// Cyprus comes as two shapes (north and south): give the flag to the southern one only
const cy = out.filter(c => c.he === 'קפריסין');
if (cy.length > 1) cy.sort((a, b) => a.c[1] - b.c[1]).slice(1).forEach(c => { c.c = null; });

const js = `// Generated by tools/make-world.mjs from Natural Earth (public domain) via world-atlas. Do not edit by hand.
// Each country: he (Hebrew name), f (flag), b (bounding box), c (where its flag goes), p (outline rings: lon,lat,lon,lat...)
export const COUNTRIES = ${JSON.stringify(out)};
`;
writeFileSync(new URL('../js/world.js', import.meta.url), js);
console.log(`wrote js/world.js: ${out.length} countries, ${(js.length / 1024).toFixed(0)} KB`);
