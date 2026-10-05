/* מנוע הלמידה: שמירה, מודל ידע לכל ילדה, שלב סמוי, חזרה מרווחת ומסתגלת, ותכנון מפגש */
(function () {
  const K = window.K;
  const KEY = 'kfar-otiot-v1';

  // ---------- שמירה ----------
  let mem = null;
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { mem = null; }
    if (!mem || typeof mem !== 'object') mem = {};
    mem.profiles = mem.profiles || {};
    mem.settings = mem.settings || { items: 12, voice: true };
    // הגירה מגרסה קודמת: אותיות שסומנו "הוכרו" בלי תאריך היכרות – מחזירים להן את הציור לשני מפגשים
    for (const p of Object.values(mem.profiles)) {
      for (const r of Object.values(p.letters || {})) if (r.intro && r.introAt == null) r.introAt = p.sessions || 0;
    }
    return mem;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* בלי אחסון – המשחק עדיין עובד */ }
  }
  K.store = { load, save };

  const norm = (n) => n.trim().replace(/\s+/g, ' ');
  K.profiles = () => Object.values(load().profiles).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  K.getProfile = (id) => load().profiles[id];
  K.findByName = (name) => K.profiles().find((p) => p.name === norm(name));

  K.createProfile = function (name, avatar) {
    const db = load();
    const existing = K.findByName(name);
    if (existing) return existing;
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const p = {
      id, name: norm(name), avatar: avatar || '🦊', created: Date.now(), lastPlayed: Date.now(),
      placementDone: false, letters: {}, finals: {}, words: { s: 0, n: 0, c: 0 },
      sessions: 0, lastNew: null, history: [], log: [],
    };
    db.profiles[id] = p;
    save();
    return p;
  };
  K.deleteProfile = (id) => { delete load().profiles[id]; save(); };
  K.touch = (p) => { p.lastPlayed = Date.now(); save(); };

  // ---------- מודל ידע ----------
  // s = חוזק 0..6 ; intro = כבר הוצגה בשיעור ; conf = עם מה התבלבלה
  function rec(p, ch) {
    const bag = K.LETTERS[ch] ? p.letters : p.finals;
    return (bag[ch] = bag[ch] || { s: 0, n: 0, c: 0, conf: {}, last: 0, intro: false });
  }
  K.rec = rec;

  // דעיכת התומך: ככל שהאות יציבה יותר – פחות ציור
  // הציור נשאר לפחות שני מפגשים אחרי ההיכרות, ודוהה רק כשהאות גם חזקה וגם "ותיקה"
  K.supportFor = function (p, ch) {
    const r = rec(p, ch);
    if (!K.LETTERS[ch]) return 2;
    if (!r.intro) return 0;
    const age = p.sessions - (r.introAt ?? -99);
    const byAge = age < 2 ? 0 : age < 4 ? 1 : age < 6 ? 2 : 3;
    const byStrength = r.s < 1.5 ? 0 : r.s < 2.8 ? 1 : r.s < 4.2 ? 2 : 3;
    return Math.min(byAge, byStrength);
  };
  K.introduce = function (p, ch) {
    const r = rec(p, ch);
    if (!r.intro) { r.intro = true; r.introAt = p.sessions; r.s = Math.max(r.s, 0.6); save(); }
  };

  K.record = function (p, ch, correct, chosen, support) {
    const r = rec(p, ch);
    r.n++;
    r.last = p.sessions;
    if (correct) {
      r.c++;
      // תשובה נכונה מול אות "חשופה" שווה יותר מתשובה עם ציור
      r.s = Math.min(6, r.s + [0.55, 0.7, 0.85, 1][support ?? 3]);
    } else {
      r.s = Math.max(0, r.s - 1.1);
      if (chosen && chosen !== ch) r.conf[chosen] = (r.conf[chosen] || 0) + 1;
    }
    p.log.push([Date.now(), ch, correct ? 1 : 0, chosen || '']);
    if (p.log.length > 600) p.log.splice(0, p.log.length - 600);
    save();
  };
  K.recordWord = function (p, correct) {
    p.words.n++;
    if (correct) { p.words.c++; p.words.s = Math.min(6, p.words.s + 0.6); } else p.words.s = Math.max(0, p.words.s - 0.8);
    save();
  };

  K.introduced = (p) => K.ORDER.filter((ch) => rec(p, ch).intro);
  K.knownLetters = (p) => K.ORDER.filter((ch) => rec(p, ch).s >= 3.5);
  K.masteredLetters = (p) => K.ORDER.filter((ch) => rec(p, ch).s >= 5);

  // שלב סמוי – לא מוצג לילדה בשום מקום, רק באזור ההורים
  K.stage = function (p) {
    if (p.stageOverride) return p.stageOverride;
    const known = K.knownLetters(p).length;
    if (known < 5) return 1;
    if (known < 12) return 2;
    if (known < 20 || p.words.s < 2) return 3;
    return 4;
  };
  K.STAGE_NAMES = { 1: 'היכרות ראשונה עם אותיות', 2: 'אותיות וצליל פותח', 3: 'מילים קצרות', 4: 'אותיות סופיות וקריאת מילים' };

  // ---------- בוחן פתיחה סמוי ("עפיפונים") ----------
  K.PLACEMENT_ORDER = ['ל', 'י', 'ע', 'מ', 'ב', 'א', 'ש', 'ו', 'ה', 'ס', 'ד', 'ר', 'פ', 'נ', 'ג', 'כ', 'ת', 'ק', 'ט', 'ח', 'ז', 'צ'];
  K.applyPlacement = function (p, results, wordResults) {
    // results: {ch: true/false}; אותיות שלא נבדקו – נשארות לא ידועות
    for (const [ch, ok] of Object.entries(results)) {
      const r = rec(p, ch);
      // גם אות שהילדה כבר מכירה עוברת היכרות עם הדמות שלה – רק קצרה יותר
      if (ok) { r.s = 3.6; r.pre = true; } else { r.s = 0; }
    }
    const tested = Object.keys(results).length;
    const right = Object.values(results).filter(Boolean).length;
    // מצליחה כמעט בהכול ונבדקו מעט – אותיות שלא נבדקו מקבלות "אולי"
    if (tested < K.ORDER.length && right >= tested - 1 && tested >= 12) {
      K.ORDER.forEach((ch) => { if (!(ch in results)) { const r = rec(p, ch); r.s = 2; r.pre = true; } });
    }
    const wr = wordResults.filter(Boolean).length;
    p.words.s = wr >= 4 ? 3 : wr >= 2 ? 1.5 : 0;
    p.placementDone = true;
    p.placement = { date: Date.now(), tested, right, words: `${wr}/${wordResults.length}` };
    save();
  };

  // ---------- עזרים ----------
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  K.shuffle = shuffle; K.pick = pick;
  const similarTo = (ch) => K.SIMILAR.filter((g) => g.includes(ch)).flat().filter((x) => x !== ch && K.LETTERS[x]);

  // מסיחים: בהתחלה אותיות שונות מאוד; בשלב מתקדם גם אותיות דומות שכבר מוכרות
  K.distractors = function (p, ch, n) {
    const intro = K.introduced(p).filter((x) => x !== ch);
    const sim = similarTo(ch).filter((x) => intro.includes(x) && rec(p, x).s >= 2.5 && rec(p, ch).s >= 2.5);
    const pool = shuffle(intro.filter((x) => !similarTo(ch).includes(x)));
    const extra = shuffle(K.ORDER.filter((x) => x !== ch && !intro.includes(x) && !similarTo(ch).includes(x)));
    const out = [];
    if (sim.length && K.stage(p) >= 2 && Math.random() < 0.5) out.push(pick(sim));
    for (const x of [...pool, ...extra]) { if (out.length >= n) break; if (!out.includes(x)) out.push(x); }
    return out.slice(0, n);
  };

  // מספר אפשרויות לפי הצלחה אחרונה
  K.choiceCount = function (p) {
    const recent = p.log.slice(-12);
    const acc = recent.length ? recent.filter((x) => x[2]).length / recent.length : 0.7;
    const st = K.stage(p);
    let n = st === 1 ? 2 : 3;
    if (acc > 0.8 && recent.length >= 8) n++;
    if (acc < 0.5) n--;
    return Math.max(2, Math.min(4, n));
  };

  // משקל לחזרה: חלשות, שלא נראו מזמן ושהתבלבלו בהן – חוזרות יותר
  function weight(p, ch) {
    const r = rec(p, ch);
    const since = p.sessions - (r.last || 0);
    const errRate = r.n ? 1 - r.c / r.n : 0.5;
    return (6.5 - r.s) * 1.4 + Math.min(4, since) * 0.8 + errRate * 3 + 0.3;
  }
  function weightedPick(p, list, avoid = []) {
    const opts = list.filter((x) => !avoid.includes(x));
    if (!opts.length) return pick(list);
    const ws = opts.map((x) => weight(p, x));
    let t = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < opts.length; i++) { t -= ws[i]; if (t <= 0) return opts[i]; }
    return opts[opts.length - 1];
  }

  // אות חדשה לגמרי (שיעור מלא) / אותיות שהילדה כבר יודעת ועוד לא פגשה את הדמות שלהן (היכרות קצרה)
  K.nextNewLetter = function (p) {
    return K.ORDER.find((ch) => !rec(p, ch).intro && !rec(p, ch).pre) || null;
  };
  K.toMeet = (p) => K.ORDER.filter((ch) => !rec(p, ch).intro && rec(p, ch).pre);

  // אזורי המסע – כל אחד פותח סוג משחק חדש. מוצגים לילדה כמקומות במפה, בלי מספרים.
  K.AREAS = [
    { stage: 1, name: 'גן האותיות', icon: '🌷', color: '#bdf0a8', game: 'מכירות אותיות חדשות ומפוצצות בלונים' },
    { stage: 2, name: 'נהר הצלילים', icon: '🌊', color: '#bfe6ff', game: 'שומעות מילה ומוצאות באיזו אות היא מתחילה' },
    { stage: 3, name: 'גשר המילים', icon: '🌉', color: '#ffe3b8', game: 'בונות מילים מאותיות' },
    { stage: 4, name: 'מגדל הסופיות', icon: '🏰', color: '#e6d9ff', game: 'אותיות שמותחות רגל בסוף המילה, וקוראות מילים' },
  ];
  K.nextFinal = function (p) {
    return Object.keys(K.FINALS).find((f) => !rec(p, f).intro && rec(p, K.FINALS[f].base).s >= 3) || null;
  };

  // מילים שכל האותיות שלהן כבר הוצגו
  K.buildableWords = function (p, withFinals) {
    const intro = new Set(K.introduced(p));
    Object.keys(K.FINALS).forEach((f) => { if (rec(p, f).intro) intro.add(f); });
    const list = withFinals ? [...K.BUILD, ...K.BUILD_FINAL] : K.BUILD;
    return list.filter((w) => Array.from(w).every((c) => intro.has(c)));
  };
  K.firstSoundWords = function (p) {
    const intro = new Set(K.introduced(p));
    return K.WORDS.filter((x) => intro.has(x.w[0]));
  };

  // ---------- תכנון מפגש (10–15 דקות) ----------
  K.planSession = function (p, nItems, opts = {}) {
    nItems = nItems || load().settings.items || 12;
    const st = K.stage(p);
    const plan = { lesson: null, finalLesson: null, items: [] };

    // אות חדשה אחת בכל מפגש (ג׳ונס ורויצל) – אם המפגש הקודם לא היה קשה מדי
    const last = p.history[p.history.length - 1];
    const struggling = last && last.total >= 6 && last.right / last.total < 0.5;
    const nl = K.nextNewLetter(p);
    plan.meet = [];
    if (opts.noLesson) { /* משחק ביחד – רק תרגול של מה שכבר נלמד */ }
    else {
      plan.meet = K.toMeet(p).slice(0, nl ? 2 : 4);
      if (nl && !(struggling && K.introduced(p).length >= 3)) plan.lesson = nl;
      else if (!nl && !plan.meet.length && st >= 3) plan.finalLesson = K.nextFinal(p);
    }
    // מפגש עם היכרויות – פחות תרגול, כדי שיישאר קצר
    if (plan.meet.length) nItems = Math.max(8, nItems - plan.meet.length - (plan.lesson ? 2 : 0));

    const pool = [...new Set([...K.introduced(p), ...(plan.lesson ? [plan.lesson] : []), ...plan.meet])];
    if (!pool.length) return plan;

    const types = [];
    const push = (t, n) => { for (let i = 0; i < n; i++) types.push(t); };
    if (st === 1) { push('pick', nItems - 2); push('balloons', 1); push('pick', 1); }
    else if (st === 2) { push('pick', nItems - 6); push('first', 3); push('discriminate', 1); push('balloons', 1); push('pick', 1); }
    else if (st === 3) { push('pick', nItems - 8); push('first', 2); push('discriminate', 1); push('build', 3); push('read', 1); push('balloons', 1); }
    else { push('pick', nItems - 9); push('first', 1); push('discriminate', 1); push('build', 3); push('read', 3); push('balloons', 1); }

    // אם אין מילים לבנות – מחליפים בתרגול אותיות
    const words = K.buildableWords(p, st >= 4);
    const pairs = K.SIMILAR.filter(([a, b]) => K.LETTERS[a] && K.LETTERS[b] && rec(p, a).intro && rec(p, b).intro && rec(p, a).s >= 2 && rec(p, b).s >= 2);
    const finalsIntro = Object.keys(K.FINALS).filter((f) => rec(p, f).intro);

    const recentLetters = [], usedWords = [];
    let newLetterCount = 0;
    const items = shuffle(types).map((t) => {
      if ((t === 'build' || t === 'read') && words.length < 2) t = 'pick';
      if (t === 'discriminate' && !pairs.length) t = 'pick';
      if (t === 'first' && K.firstSoundWords(p).length < 3) t = 'pick';
      if (t === 'pick' || t === 'balloons') {
        let ch;
        // האות החדשה חוזרת שלוש פעמים במפגש
        if (plan.lesson && newLetterCount < 3 && Math.random() < 0.45) { ch = plan.lesson; newLetterCount++; }
        else if (finalsIntro.length && st >= 4 && Math.random() < 0.2) ch = pick(finalsIntro);
        else ch = weightedPick(p, pool, recentLetters.slice(-2));
        recentLetters.push(ch);
        return { type: t, ch };
      }
      if (t === 'first') {
        const fw = K.firstSoundWords(p);
        const weak = weightedPick(p, [...new Set(fw.map((x) => x.w[0]))]);
        const opts = fw.filter((x) => x.w[0] === weak);
        return { type: t, word: pick(opts).w };
      }
      if (t === 'discriminate') {
        const pr = pairs.slice().sort((x, y) => (rec(p, x[0]).s + rec(p, x[1]).s) - (rec(p, y[0]).s + rec(p, y[1]).s))[0];
        return { type: t, pair: pr, ch: pick(pr) };
      }
      // בלי לחזור על אותה מילה באותו מפגש
      const fresh = words.filter((w) => !usedWords.includes(w));
      const w = pick(fresh.length ? fresh : words);
      usedWords.push(w);
      return { type: t, word: w };
    });
    // הבטחה שהאות החדשה מופיעה לפחות פעמיים
    if (plan.lesson) {
      const idx = items.map((x, i) => (x.type === 'pick' ? i : -1)).filter((i) => i >= 0);
      let have = items.filter((x) => x.ch === plan.lesson).length;
      for (const i of idx) { if (have >= 2) break; if (items[i].ch !== plan.lesson) { items[i].ch = plan.lesson; have++; } }
    }
    plan.items = items;
    return plan;
  };

  // משחק ביחד: תורות, כל אחת מקבלת פריטים לפי הידע שלה
  K.planCoop = function (pa, pb, perPlayer) {
    const a = K.planSession(pa, perPlayer, { noLesson: true }).items, b = K.planSession(pb, perPlayer, { noLesson: true }).items;
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push({ ...a[i], who: pa.id });
      if (b[i]) out.push({ ...b[i], who: pb.id });
    }
    return out;
  };

  K.endSession = function (p, stats, newLetter) {
    p.sessions++;
    p.history.push({ date: Date.now(), total: stats.total, right: stats.right, newLetter: newLetter || null });
    if (p.history.length > 200) p.history.shift();
    if (newLetter) p.lastNew = newLetter;
    p.lastPlayed = Date.now();
    save();
  };

  // ---------- גיבוי ----------
  K.exportProfile = (p) => btoa(unescape(encodeURIComponent(JSON.stringify(p))));
  K.importProfile = function (code) {
    const p = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!p || !p.id || !p.name || !p.letters) throw new Error('bad');
    load().profiles[p.id] = p;
    save();
    return p;
  };
})();
