/* ציור: אות משובצת בדרגות דעיכה, פה, ינשוף מדריך, עפיפון, בלון */
(function () {
  const K = window.K;
  const INK = '#3b2a6b';
  const VB = '-8 -14 116 132';

  // support: 0 = ציור מלא, 1 = ציור דהוי, 2 = רק קו האות, 3 = אות בגופן רגיל
  K.letterArt = function (ch, support = 0, opts = {}) {
    const fin = K.FINALS[ch];
    const info = K.LETTERS[ch];
    if (support >= 3) {
      return `<div class="glyph-font${opts.small ? ' small' : ''}" aria-label="${ch}">${ch}</div>`;
    }
    const d = info ? info.d : fin.d;
    const deco = info && support < 2 ? info.deco() : '';
    const op = support === 1 ? 0.28 : 1;
    const cls = opts.cls ? ` class="${opts.cls}"` : '';
    return `<svg${cls} viewBox="${VB}" role="img" aria-label="${ch}">` +
      (deco ? `<g class="deco" opacity="${op}">${deco}</g>` : '') +
      `<path class="glyph" d="${d}" fill="none" stroke="${opts.ink || INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`;
  };

  // אות לכתיבה – קו מונפש שמראה את כיוון הכתיבה
  K.letterTrace = function (ch) {
    const info = K.LETTERS[ch] || K.FINALS[ch];
    const parts = info.d.split(/(?=M)/);
    return `<svg viewBox="${VB}" class="trace">` +
      `<path d="${info.d}" fill="none" stroke="#e6e0f5" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` +
      parts.map((p, i) => `<path d="${p}" pathLength="100" class="trace-stroke" style="animation-delay:${0.3 + i * 1.1}s" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`).join('') +
      `</svg>`;
  };

  // תנוחות פה (בויר ואהרי 2011): שפתיים סגורות, לשון למעלה, שיניים, פה פתוח…
  K.mouthArt = function (type) {
    const lips = '#e8607a', in_ = '#7a2238', teeth = '#fff', tongue = '#ff8fa3';
    const face = `<ellipse cx="60" cy="40" rx="56" ry="36" fill="#ffd9b3"/>`;
    const m = {
      lips: `<path d="M24 40 Q60 22 96 40 Q60 58 24 40Z" fill="${lips}"/><path d="M26 40 Q60 44 94 40" stroke="${in_}" stroke-width="3" fill="none"/>`,
      open: `<ellipse cx="60" cy="42" rx="26" ry="22" fill="${lips}"/><ellipse cx="60" cy="43" rx="20" ry="16" fill="${in_}"/><ellipse cx="60" cy="52" rx="13" ry="6" fill="${tongue}"/>`,
      tongue: `<ellipse cx="60" cy="42" rx="30" ry="16" fill="${lips}"/><ellipse cx="60" cy="42" rx="24" ry="11" fill="${in_}"/><rect x="40" y="31" width="40" height="6" rx="2" fill="${teeth}"/><path d="M44 50 Q60 30 76 50Z" fill="${tongue}"/>`,
      hiss: `<path d="M22 40 Q60 22 98 40 Q60 58 22 40Z" fill="${lips}"/><rect x="34" y="34" width="52" height="12" rx="4" fill="${teeth}"/><line x1="34" y1="40" x2="86" y2="40" stroke="#ddd" stroke-width="1.5"/>`,
      back: `<ellipse cx="60" cy="42" rx="24" ry="17" fill="${lips}"/><ellipse cx="60" cy="42" rx="18" ry="12" fill="${in_}"/><path d="M46 52 Q60 44 74 52Z" fill="${tongue}"/>`,
      roll: `<ellipse cx="60" cy="42" rx="26" ry="16" fill="${lips}"/><ellipse cx="60" cy="42" rx="20" ry="11" fill="${in_}"/><path d="M46 50 Q60 34 74 50 Q60 46 46 50Z" fill="${tongue}"/>`,
      smile: `<path d="M18 34 Q60 66 102 34 Q60 46 18 34Z" fill="${lips}"/><path d="M28 38 Q60 50 92 38 Q60 44 28 38Z" fill="${teeth}"/>`,
      teeth: `<path d="M24 40 Q60 24 96 40 Q60 56 24 40Z" fill="${lips}"/><rect x="38" y="32" width="44" height="10" rx="3" fill="${teeth}"/>`,
    }[type] || '';
    return `<svg viewBox="0 0 120 80" class="mouth">${face}${m}</svg>`;
  };
  K.MOUTH_TIP = {
    lips: 'השפתיים נסגרות ואז נפתחות בפיצוץ קטן',
    open: 'הפה פתוח גדול',
    tongue: 'קצה הלשון נוגע למעלה, מאחורי השיניים',
    hiss: 'השיניים קרובות, והאוויר שורק',
    back: 'הצליל יוצא מאחור, מהגרון',
    roll: 'הלשון רוטטת, כמו מנוע קטן',
    smile: 'מחייכים חיוך רחב',
    teeth: 'השיניים העליונות נוגעות בשפה התחתונה',
  };

  // ינשופה המדריכה – "נוֹגָה"
  K.owl = function (mood = 'happy') {
    const eyes = mood === 'sleep'
      ? `<path d="M34 46 Q42 52 50 46" stroke="#3b2a6b" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M70 46 Q78 52 86 46" stroke="#3b2a6b" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
      : `<circle cx="42" cy="46" r="13" fill="#fff"/><circle cx="78" cy="46" r="13" fill="#fff"/><circle class="pupil" cx="44" cy="47" r="6.5" fill="#3b2a6b"/><circle class="pupil" cx="76" cy="47" r="6.5" fill="#3b2a6b"/><circle cx="46" cy="44" r="2" fill="#fff"/><circle cx="78" cy="44" r="2" fill="#fff"/>`;
    return `<svg viewBox="0 0 120 130" class="owl ${mood}">
      <path d="M20 30 L30 8 L44 24 Z M100 30 L90 8 L76 24 Z" fill="#8a63d2"/>
      <ellipse cx="60" cy="72" rx="46" ry="52" fill="#a07ce8"/>
      <ellipse cx="60" cy="86" rx="30" ry="34" fill="#efe6ff"/>
      <path d="M44 84 q4 4 8 0 M56 92 q4 4 8 0 M68 84 q4 4 8 0 M50 102 q4 4 8 0 M62 102 q4 4 8 0" stroke="#c9b5f2" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${eyes}
      <path d="M54 58 L66 58 L60 68 Z" fill="#ffb03b"/>
      <ellipse class="wing-l" cx="16" cy="80" rx="11" ry="26" fill="#8a63d2"/>
      <ellipse class="wing-r" cx="104" cy="80" rx="11" ry="26" fill="#8a63d2"/>
      <path d="M44 122 l-4 6 M50 123 l0 6 M70 123 l0 6 M76 122 l4 6" stroke="#ffb03b" stroke-width="3.5" stroke-linecap="round"/>
      ${mood === 'sleep' ? '<path d="M28 6 Q60 -10 92 6 L86 16 Q60 4 34 16Z" fill="#5bbcf0"/><circle cx="96" cy="4" r="5" fill="#fff"/>' : ''}
    </svg>`;
  };

  const KITE_COLORS = [['#ff7a59', '#ffc83d'], ['#2bb3a3', '#9be07a'], ['#8a63d2', '#ff8fb1'], ['#4f9fe0', '#ffd84a']];
  K.kite = function (i) {
    const [a, b] = KITE_COLORS[i % KITE_COLORS.length];
    return `<svg viewBox="0 0 100 160" class="kite-svg"><path d="M50 4 L92 56 L50 112 L8 56 Z" fill="${a}"/><path d="M50 4 L92 56 L50 56 Z M50 56 L8 56 L50 112Z" fill="${b}"/>` +
      `<path d="M50 112 Q40 128 52 138 Q64 148 50 158" stroke="#7a6a9a" stroke-width="2" fill="none"/>` +
      `<path d="M44 126 l8 4 l-8 4z M54 144 l-8 4 l8 4z" fill="${a}"/></svg>`;
  };

  const BAL = ['#ff6b8b', '#ffc83d', '#5bbcf0', '#9be07a', '#b48cff', '#ff9f4a'];
  K.balloon = function (i) {
    const c = BAL[i % BAL.length];
    return `<svg viewBox="0 0 80 130" class="balloon-svg"><ellipse cx="40" cy="42" rx="34" ry="40" fill="${c}"/><ellipse cx="28" cy="26" rx="8" ry="12" fill="#fff" opacity=".45"/><path d="M36 82 L44 82 L40 88Z" fill="${c}"/><path d="M40 88 Q34 104 42 114 Q48 122 40 130" stroke="#9a8fb5" stroke-width="2" fill="none"/></svg>`;
  };
})();
