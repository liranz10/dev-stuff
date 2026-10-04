/* כפר האותיות – מסכים וזרימת המשחק */
(function () {
  const K = window.K;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PRAISE = ['כל הכבוד!', 'נכון!', 'מצוין!', 'יופי!', 'איזה יופי!', 'נהדר!', 'בדיוק!'];
  const AVATARS = ['🦊', '🐰', '🐱', '🐼', '🦄', '🐶', '🐸', '🦁', '🐨', '🐯', '🦋', '🐢'];
  const HOUSE_COLORS = ['#ff7a6b', '#ffb03b', '#2bb3a3', '#8a63d2', '#4f9fe0', '#ff8fb1'];

  let cur = null;        // הפרופיל הפעיל
  let repeatFn = null;   // מה כפתור הרמקול מקריא שוב
  let screenId = 0;      // מונע תגובות ממסך שכבר עזבנו

  // ---------- מסגרת ----------
  function topbar({ home = false, back = null, progress = null, parent = false, speaker = true } = {}) {
    const tb = $('#topbar');
    tb.innerHTML =
      (home ? `<button class="icon-btn" id="tb-home" aria-label="הביתה">🏠</button>` : '') +
      (back ? `<button class="icon-btn" id="tb-back" aria-label="חזרה">➡️</button>` : '') +
      `<div class="grow">${progress ? progressHtml(progress) : ''}</div>` +
      (speaker ? `<button class="icon-btn" id="tb-say" aria-label="להקריא שוב">🔊</button>` : '') +
      (parent ? `<button class="icon-btn small" id="tb-parent" aria-label="אזור הורים">⚙️</button>` : '');
    if (home) $('#tb-home').onclick = () => { K.sfx.tap(); cur ? childHome() : welcome(); };
    if (back) $('#tb-back').onclick = () => { K.sfx.tap(); back(); };
    if (speaker) $('#tb-say').onclick = () => { K.unlockAudio(); repeatFn && repeatFn(); };
    if (parent) $('#tb-parent').onclick = () => parentGate();
  }
  function progressHtml([i, n]) {
    return `<div class="progress" aria-label="התקדמות">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</div>`;
  }
  function setProgress(i, n) { const g = $('#topbar .grow'); if (g) g.innerHTML = progressHtml([i, n]); }

  function screen(html) {
    screenId++;
    K.stopSpeech();
    const st = $('#stage');
    st.innerHTML = html;
    st.classList.remove('enter'); void st.offsetWidth; st.classList.add('enter');
    st.scrollTop = 0;
    return screenId;
  }
  const alive = (id) => id === screenId;

  function speak(text, extra) {
    repeatFn = () => (Array.isArray(text) ? K.sayAll(text) : K.say(text));
    if (extra) repeatFn = extra;
    return Array.isArray(text) ? K.sayAll(text) : K.say(text);
  }

  function owlSays(text, mood = 'happy') {
    return `<div class="owl-wrap">${K.owl(mood)}<div class="bubble"><p class="say">${esc(text)}</p></div></div>`;
  }

  function confetti(n = 70) {
    const c = document.createElement('div');
    c.className = 'confetti';
    const cols = ['#ff7a59', '#ffc83d', '#2bb3a3', '#8a63d2', '#ff8fb1', '#4f9fe0'];
    c.innerHTML = Array.from({ length: n }, () =>
      `<i style="left:${Math.random() * 100}%;background:${K.pick(cols)};animation-duration:${2 + Math.random() * 2.5}s;animation-delay:${Math.random() * 0.8}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5500);
  }

  // ---------- מסך פתיחה: מי משחקת? ----------
  function welcome() {
    cur = null;
    topbar({ parent: true });
    const profs = K.profiles();
    const presets = ['יובל', 'עלמה'].filter((n) => !K.findByName(n));
    const placed = profs.filter((p) => p.placementDone);
    screen(`
      <h1 class="logo">${Array.from('כפר האותיות').map((c) => (c === ' ' ? ' ' : `<span class="lt">${c}</span>`)).join('')}</h1>
      ${owlSays(profs.length ? 'מי משחקת היום?' : 'שלום! אני נוגה הינשופה. מי באה לשחק?')}
      <div class="players">
        ${profs.map((p) => `<button class="player" data-id="${p.id}"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}</span></button>`).join('')}
        ${presets.map((n) => `<button class="player new" data-new="${n}"><span class="av">✨</span><span class="nm">${n}</span></button>`).join('')}
        <button class="player new" data-other="1"><span class="av">➕</span><span class="nm" style="font-size:24px">שם אחר</span></button>
      </div>
      ${placed.length >= 2 ? `<button class="btn teal" id="coop">👭 משחקות ביחד</button>` : ''}
    `);
    speak(profs.length ? 'מי משחקת היום?' : 'שלום! אני נוגה הינשופה. מי באה לשחק?');
    $$('.player[data-id]').forEach((b) => (b.onclick = () => { K.unlockAudio(); K.sfx.tap(); openProfile(K.getProfile(b.dataset.id)); }));
    $$('.player[data-new]').forEach((b) => (b.onclick = () => { K.unlockAudio(); K.sfx.tap(); pickAvatar(b.dataset.new); }));
    $('.player[data-other]').onclick = () => { K.unlockAudio(); K.sfx.tap(); askName(); };
    if ($('#coop')) $('#coop').onclick = () => { K.unlockAudio(); K.sfx.tap(); coopSetup(); };
  }

  function askName() {
    topbar({ back: welcome });
    screen(`
      ${owlSays('איך קוראים לך?')}
      <form id="nf" class="row" autocomplete="off">
        <input id="name-input" class="name-input" maxlength="16" placeholder="השם שלי" aria-label="שם">
        <button class="btn" type="submit">✓</button>
      </form>
      <p class="note">אם כבר שיחקת, כותבים את אותו השם וחוזרים בדיוק למקום שעצרת.</p>
    `);
    speak('איך קוראים לך? אפשר לבקש מאבא או מאמא לכתוב.');
    const inp = $('#name-input');
    setTimeout(() => inp.focus(), 300);
    $('#nf').onsubmit = (e) => {
      e.preventDefault();
      const n = inp.value.trim();
      if (!n) return;
      const ex = K.findByName(n);
      if (ex) openProfile(ex); else pickAvatar(n);
    };
  }

  function pickAvatar(name) {
    topbar({ back: welcome });
    let sel = null;
    screen(`
      ${owlSays(`שלום ${name}! בחרי חבר שישחק איתך`)}
      <div class="avatars">${AVATARS.map((a) => `<button data-a="${a}" aria-label="${a}">${a}</button>`).join('')}</div>
      <button class="btn" id="go" hidden>יוצאות לדרך!</button>
    `);
    speak(`שלום ${name}! בחרי חבר שישחק איתך.`);
    $$('.avatars button').forEach((b) => (b.onclick = () => {
      K.sfx.pop();
      $$('.avatars button').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel'); sel = b.dataset.a; $('#go').hidden = false;
    }));
    $('#go').onclick = () => {
      K.sfx.tap();
      const p = K.createProfile(name, sel);
      openProfile(p);
    };
  }

  function openProfile(p) {
    cur = p;
    K.touch(p);
    if (!p.placementDone) placementIntro(); else childHome();
  }

  // ---------- בית של ילדה ----------
  function childHome() {
    topbar({ back: welcome, parent: true });
    const p = cur;
    const village = K.introduced(p).length;
    const greet = p.sessions === 0 ? `שלום ${p.name}! מוכנה להכיר אות חדשה?` : K.pick([`שלום ${p.name}! איזה כיף שחזרת!`, `היי ${p.name}! נוגה התגעגעה אלייך!`, `${p.name}! בואי נשחק עם האותיות!`]);
    screen(`
      <div class="player" style="pointer-events:none"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}</span></div>
      ${owlSays(greet)}
      <button class="btn huge pulse" id="play">▶ בואי נשחק!</button>
      <button class="btn white" id="village">🏡 הכפר שלי ${village ? `<small style="opacity:.6">(${village})</small>` : ''}</button>
    `);
    speak(greet);
    $('#play').onclick = () => { K.unlockAudio(); K.sfx.tap(); runSession(); };
    $('#village').onclick = () => { K.sfx.tap(); villageScreen(); };
  }

  // ---------- בוחן פתיחה סמוי: עפיפונים ----------
  function placementIntro() {
    topbar({ back: welcome });
    const t = `שלום ${cur.name}! בואי נעיף עפיפונים! אני אגיד אות, ואת תלחצי על העפיפון שלה. אם את לא יודעת, זה בסדר גמור, פשוט לוחצים על עפיפון.`;
    screen(`${owlSays(`שלום ${cur.name}! בואי נעיף עפיפונים!`)}<div class="sky-field">${[0, 1, 2].map((i) => `<div class="kite">${K.kite(i)}</div>`).join('')}</div><button class="btn huge pulse" id="go">🪁 מתחילות</button>`);
    speak(t);
    $('#go').onclick = () => { K.unlockAudio(); K.sfx.tap(); placement(); };
  }

  async function placement() {
    const p = cur;
    const results = {}, wordRes = [];
    let errors = 0, asked = 0;
    const MAX = 16;
    const cheer = ['יופי!', 'וואו, איזה עפיפון!', 'הוא עף!', 'שיגור!', 'למעלה למעלה!'];
    topbar({ back: welcome, progress: [0, MAX] });

    const kiteRound = (labels, prompt, isEmoji) => new Promise((resolve) => {
      const id = screen(`${owlSays(prompt.text)}<div class="sky-field">${labels.map((l, i) => `<button class="kite" data-v="${esc(l.v)}" aria-label="${esc(l.v)}">${K.kite(i + asked)}<div class="k-letter${isEmoji ? ' emoji' : ''}">${l.show}</div></button>`).join('')}</div>`);
      speak(prompt.speak);
      $$('.kite').forEach((b) => (b.onclick = () => {
        if (!alive(id)) return;
        $$('.kite').forEach((x) => (x.onclick = null));
        K.sfx.whoosh();
        b.classList.add('fly');
        K.say(K.pick(cheer));
        setTimeout(() => resolve(b.dataset.v), 1100);
      }));
    });

    for (const ch of K.PLACEMENT_ORDER) {
      if (asked >= MAX || errors >= 4) break;
      const info = K.LETTERS[ch];
      const others = K.shuffle(K.ORDER.filter((x) => x !== ch && !K.SIMILAR.some((g) => g.includes(x) && g.includes(ch)))).slice(0, 2);
      const opts = K.shuffle([ch, ...others]).map((x) => ({ v: x, show: x }));
      setProgress(asked, MAX);
      const ans = await kiteRound(opts, { text: `איפה ${info.name}?`, speak: `איפה האות ${info.name}?` });
      results[ch] = ans === ch;
      if (!results[ch]) errors++;
      asked++;
    }
    const right = Object.values(results).filter(Boolean).length;
    // מילים – רק למי שמכירה הרבה אותיות
    if (right >= 9) {
      const fsw = K.shuffle(K.WORDS.filter((w) => results[w.w[0]] && w.w.length <= 4)).slice(0, 3);
      for (const w of fsw) {
        const others = K.shuffle(Object.keys(results).filter((x) => results[x] && x !== w.w[0])).slice(0, 2);
        const opts = K.shuffle([w.w[0], ...others]).map((x) => ({ v: x, show: x }));
        const ans = await kiteRound(opts, { text: `${w.e}  באיזו אות מתחילה ${w.w}?`, speak: `${w.w}. באיזו אות מתחילה המילה ${w.w}?` });
        wordRes.push(ans === w.w[0]);
      }
      if (wordRes.filter(Boolean).length >= 2) {
        const rw = K.shuffle(K.BUILD.filter((w) => K.wordInfo(w))).slice(0, 3);
        for (const w of rw) {
          const others = K.shuffle(K.WORDS.filter((x) => x.w !== w && x.w[0] !== w[0])).slice(0, 2);
          const opts = K.shuffle([K.wordInfo(w), ...others]).map((x) => ({ v: x.w, show: x.e }));
          const ans = await kiteRound(opts, { text: `מה כתוב כאן?  ${w}`, speak: 'מה כתוב כאן? לחצי על התמונה.' }, true);
          wordRes.push(ans === w);
        }
      }
    }
    K.applyPlacement(p, results, wordRes);
    topbar({ home: true });
    screen(`${owlSays('וואו! כל העפיפונים בשמיים!', 'happy')}<div class="sky-field" style="min-height:20vh"></div><button class="btn huge" id="go">▶ ממשיכות</button>`);
    K.sfx.fanfare(); confetti();
    speak(`וואו ${p.name}! כל העפיפונים בשמיים! עכשיו בואי נכיר את כפר האותיות.`);
    $('#go').onclick = () => { K.sfx.tap(); runSession(); };
  }

  // ---------- מפגש ----------
  async function runSession() {
    const p = cur;
    const plan = K.planSession(p);
    const stats = { total: 0, right: 0 };
    const steps = (plan.lesson ? 5 : 0) + (plan.finalLesson ? 2 : 0) + plan.items.length;
    let si = 0;
    const tick = () => setProgress(si++, steps);
    topbar({ home: true, progress: [0, steps] });

    if (plan.lesson) await lesson(p, plan.lesson, tick);
    if (plan.finalLesson) await finalLesson(p, plan.finalLesson, tick);
    for (const it of plan.items) {
      tick();
      const ok = await runItem(p, it);
      if (ok === null) return; // יצאו מהמסך
      stats.total++; if (ok) stats.right++;
    }
    K.endSession(p, stats, plan.lesson || plan.finalLesson);
    endScreen(p, plan.lesson || plan.finalLesson);
  }

  function runItem(p, it) {
    switch (it.type) {
      case 'pick': return pickItem(p, it.ch);
      case 'balloons': return balloonsItem(p, it.ch);
      case 'first': return firstSoundItem(p, it.word);
      case 'discriminate': return discriminateItem(p, it.pair, it.ch);
      case 'build': return buildItem(p, it.word);
      case 'read': return readItem(p, it.word);
    }
    return Promise.resolve(true);
  }

  const nameOf = (ch) => (K.LETTERS[ch] ? K.LETTERS[ch].name : K.FINALS[ch].name);
  const soundOf = (ch) => (K.LETTERS[ch] ? K.LETTERS[ch].sound : K.LETTERS[K.FINALS[ch].base].sound);
  const nextBtn = (label = 'הלאה') => `<button class="btn next-btn" id="next">${label} ⬅</button>`;
  const waitNext = (id) => new Promise((r) => { $('#next').onclick = () => { if (alive(id)) { K.sfx.tap(); r(); } }; });

  // ---------- שיעור אות חדשה ----------
  async function lesson(p, ch, tick) {
    const L = K.LETTERS[ch];
    const r = K.rec(p, ch);
    r.intro = true; r.s = Math.max(r.s, 0.6); K.store.save();
    const twin = ch === 'ל' && ['יובל', 'עלמה'].includes(p.name);

    // 1. סיפור הדמות
    tick();
    let id = screen(`
      <p class="say big">${twin ? 'אות התאומות!' : 'אות חדשה בכפר!'}</p>
      <div class="hero pop" id="hero">${K.letterArt(ch, 0)}</div>
      <p class="say">${esc(L.story)}</p>
      ${nextBtn()}`);
    K.sfx.magic();
    speak([twin ? 'זאת אות מיוחדת: היא נמצאת גם בשם יובל וגם בשם עלמה!' : 'יש אות חדשה בכפר!', L.story]);
    await waitNext(id);

    // 2. הציור הופך לאות (האנימציה היחידה שמוצדקת דידקטית)
    tick();
    id = screen(`
      <div class="pair-hero"><div class="hero" id="hero">${K.letterArt(ch, 0)}</div><div class="font-twin hidden-twin" id="twin">${K.letterArt(ch, 3)}</div></div>
      <p class="say big">${L.name}: ${L.sound}… ${L.sound}… ${L.word}</p>
      ${nextBtn()}`);
    let nx = waitNext(id);
    await wait(900);
    if (!alive(id)) return nx;
    $('#hero').classList.add('morph');
    await wait(1300);
    if (!alive(id)) return nx;
    $('#twin').classList.remove('hidden-twin');
    const t2 = [`זאת האות ${L.name}.`, `היא אומרת ${L.sound}. ${L.sound}.`, `כמו ${L.word}.`];
    speak(t2, () => { $('#hero')?.classList.remove('morph'); setTimeout(() => $('#hero')?.classList.add('morph'), 900); K.sayAll(t2); });
    await nx;

    // 3. תנועת גוף + איך הפה זז
    tick();
    id = screen(`
      <div class="move-box">${K.mouthArt(L.mouth)}<div class="move-emoji">🙌</div></div>
      <p class="say big">${esc(L.move)}</p>
      <p class="say">ועכשיו כולן אומרות: ${L.sound}!</p>
      <p class="parent-tip"><b>להורים:</b> עשו את התנועה יחד מול המסך. ${K.MOUTH_TIP[L.mouth]}. אפשר לקבל גם תשובה בהברה ("${L.sound}").</p>
      ${nextBtn()}`);
    speak([`עכשיו נעשה ביחד: ${L.move}.`, `ונגיד ${L.sound}! ${L.sound}!`]);
    await waitNext(id);

    // 4. כתיבה חופשית באצבע (לא מעקב על קו מנוקד – ג׳יימס ואנגלהרדט 2012)
    tick();
    await writeStep(p, ch);

    // 5. איפה מתחבאת?
    tick();
    await huntStep(p, ch);
  }

  function writeStep(p, ch) {
    return new Promise((resolve) => {
      const L = K.LETTERS[ch] || K.FINALS[ch];
      const id = screen(`
        <p class="say big">עכשיו את! כתבי ${L.name} באצבע</p>
        <div class="write-area">
          <div class="write-model" id="model">${K.letterTrace(ch)}</div>
          <canvas class="pad" id="pad" width="600" height="600" aria-label="לוח כתיבה"></canvas>
        </div>
        <div class="row"><button class="btn white" id="again">🧽 מוחקים</button><button class="btn white" id="show">👀 שוב</button><button class="btn" id="done">✓ סיימתי</button></div>`);
      speak(`תראי איך כותבים ${L.name}. עכשיו את! כתבי ${L.name} באצבע, על הלוח.`);
      const cv = $('#pad'), cx = cv.getContext('2d');
      let drawing = false, pts = 0, last = null;
      const pos = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * (cv.width / b.width), (e.clientY - b.top) * (cv.height / b.height)]; };
      cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.lineWidth = 34; cx.strokeStyle = '#3b2a6b';
      cv.onpointerdown = (e) => { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.arc(last[0], last[1], 17, 0, 7); cx.fillStyle = '#3b2a6b'; cx.fill(); };
      cv.onpointermove = (e) => { if (!drawing) return; const pt = pos(e); cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(pt[0], pt[1]); cx.stroke(); last = pt; pts++; };
      cv.onpointerup = cv.onpointercancel = () => { drawing = false; };
      $('#again').onclick = () => { K.sfx.tap(); cx.clearRect(0, 0, cv.width, cv.height); pts = 0; };
      $('#show').onclick = () => { K.sfx.tap(); $('#model').innerHTML = K.letterTrace(ch); };
      $('#done').onclick = async () => {
        if (!alive(id)) return;
        if (pts < 6) { K.say(`נסי לכתוב ${L.name} על הלוח`); return; }
        K.sfx.good(); confetti(30);
        await K.say(K.pick(['איזו אות יפה!', 'כתבת בעצמך! כל הכבוד!', 'וואו, איזו כתיבה!']));
        resolve();
      };
    });
  }

  function huntStep(p, ch) {
    return new Promise((resolve) => {
      const L = K.LETTERS[ch];
      const others = K.shuffle(K.ORDER.filter((x) => x !== ch && !K.SIMILAR.some((g) => g.includes(x) && g.includes(ch)))).slice(0, 5);
      const cells = K.shuffle([ch, ch, ch, ...others]);
      const id = screen(`
        <div class="row"><div class="write-model">${K.letterArt(ch, 0)}</div><p class="say big">איפה מתחבאת ${L.name}?<br><span class="say">יש שלוש!</span></p></div>
        <div class="hunt">${cells.map((c) => `<button data-c="${c}">${c}</button>`).join('')}</div>`);
      speak(`איפה מתחבאת ${L.name}? יש שלוש. מצאי את כולן!`);
      let found = 0;
      $$('.hunt button').forEach((b) => (b.onclick = async () => {
        if (!alive(id) || b.classList.contains('found')) return;
        if (b.dataset.c === ch) {
          b.classList.add('found'); found++; K.sfx.good();
          if (found === 3) { await K.say(`מצאת את כל ה${L.name}!`); resolve(); } else K.say(K.pick(['מצאת!', 'עוד אחת!', 'יופי!']));
        } else {
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); K.sfx.soft();
          K.say(`זאת ${nameOf(b.dataset.c)}.`);
        }
      }));
    });
  }

  // ---------- שיעור אות סופית ----------
  async function finalLesson(p, f, tick) {
    const F = K.FINALS[f], B = K.LETTERS[F.base];
    K.rec(p, f).intro = true; K.rec(p, f).s = Math.max(K.rec(p, f).s, 1); K.store.save();
    tick();
    let id = screen(`
      <p class="say big">${B.name} בסוף המילה</p>
      <div class="pair-hero"><div class="hero">${K.letterArt(F.base, 0)}</div><div class="say big">⬅</div><div class="hero pop">${K.letterArt(f, 2)}</div></div>
      <p class="say">${esc(F.story)}</p>${nextBtn()}`);
    speak([`זוכרות את ${B.name}?`, F.story, `זאת ${F.name}.`]);
    await waitNext(id);
    tick();
    await writeStep(p, f);
  }

  // ---------- פריטי תרגול ----------
  // בחירת אות: "איפה ה___?"
  function pickItem(p, ch) {
    return new Promise((resolve) => {
      const isFinal = !!K.FINALS[ch];
      const n = K.choiceCount(p);
      const sup = K.supportFor(p, ch);
      let opts;
      if (isFinal) opts = K.shuffle([ch, K.FINALS[ch].base, ...K.shuffle(Object.keys(K.FINALS).filter((x) => x !== ch)).slice(0, Math.max(0, n - 2))]);
      else opts = K.shuffle([ch, ...K.distractors(p, ch, n - 1)]);
      const L = K.LETTERS[ch];
      const prompt = isFinal ? `איפה ${K.FINALS[ch].name}?` : `איפה ${L.name}?`;
      const sayIt = isFinal ? [prompt] : sup <= 1 ? [prompt, `${L.sound}… כמו ${L.word}`] : [prompt, `${L.sound}…`];
      const id = screen(`<p class="say big">${prompt}</p><div class="cards n${opts.length}">${opts.map((o) => `<button class="card" data-c="${o}" aria-label="${o}">${K.letterArt(o, isFinal ? 2 : sup)}</button>`).join('')}</div>`);
      speak(sayIt);
      choiceLogic(id, p, ch, sup, resolve, async (btn) => {
        if (!isFinal) { btn.innerHTML = K.letterArt(ch, 0); }
        await K.say(`${K.pick(PRAISE)} ${isFinal ? '' : `${L.sound}, ${L.word}!`}`);
      });
    });
  }

  // לוגיקה משותפת לבחירה בין כרטיסים: טעות → אומרים מה נבחר, שתי טעויות → מדגישים את הנכונה
  function choiceLogic(id, p, ch, sup, resolve, onGood, recordFn) {
    let tries = 0, done = false;
    $$('.card').forEach((b) => (b.onclick = async () => {
      if (!alive(id) || done) return;
      const c = b.dataset.c;
      if (c === ch) {
        done = true;
        if (tries === 0) (recordFn || ((ok) => K.record(p, ch, ok, null, sup)))(true);
        b.classList.add('good'); K.sfx.good();
        $$('.card').forEach((x) => x !== b && x.classList.add('dim'));
        await onGood(b);
        await wait(350);
        resolve(tries === 0);
      } else {
        if (tries === 0) (recordFn || ((ok, chosen) => K.record(p, ch, ok, chosen, sup)))(false, c);
        tries++;
        b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); K.sfx.soft();
        if (tries >= 2) {
          const g = $(`.card[data-c="${ch}"]`); g && g.classList.add('hint');
          await K.say(`זאת ${nameOf(c)}. ה${nameOf(ch)} כאן!`);
        } else await K.say(`זאת ${nameOf(c)}. בואי ננסה שוב.`);
      }
    }));
  }

  // בלונים: מפוצצות את האות שנאמרה (3 פעמים)
  function balloonsItem(p, ch) {
    return new Promise((resolve) => {
      const L = K.LETTERS[ch] || null;
      const nm = nameOf(ch);
      const id = screen(`<p class="say big">פוצצי את הבלונים של ${nm}!</p><div class="counter">${'<span>🎈</span>'.repeat(3)}</div><div class="balloon-field" id="bf"></div>`);
      speak(L ? [`פוצצי את הבלונים של ${nm}!`, `${L.sound}…`] : [`פוצצי את הבלונים של ${nm}!`]);
      const field = $('#bf');
      const pool = K.introduced(p).filter((x) => x !== ch && !K.SIMILAR.some((g) => g.includes(x) && g.includes(ch)));
      const fill = pool.length >= 2 ? pool : K.ORDER.filter((x) => x !== ch).slice(0, 6);
      let popped = 0, miss = 0, n = 0, recorded = false, timer;
      const H = () => field.clientHeight || 400;
      function spawn(forceTarget) {
        if (!alive(id)) return clearInterval(timer);
        const isT = forceTarget || Math.random() < 0.42;
        const c = isT ? ch : K.pick(fill);
        const b = document.createElement('button');
        b.className = 'balloon'; b.dataset.c = c;
        b.innerHTML = K.balloon(n++) + `<div class="b-letter">${c}</div>`;
        b.style.left = `${5 + Math.random() * 78}%`;
        const dur = 6 + Math.random() * 3;
        b.style.animationDuration = `${dur}s`;
        // הבלונים הראשונים כבר באמצע הדרך, כדי שהמסך לא יתחיל ריק
        if (n <= 3) b.style.animationDelay = `-${(dur * (0.2 + 0.15 * n)).toFixed(1)}s`;
        b.style.setProperty('--rise', `${-(H() + 200)}px`);
        b.onclick = () => {
          if (!alive(id) || b.classList.contains('popped')) return;
          if (b.dataset.c === ch) {
            b.classList.add('popped'); K.sfx.pop(); popped++;
            $$('.counter span')[popped - 1]?.classList.add('on');
            if (popped >= 3) {
              clearInterval(timer);
              if (!recorded) K.record(p, ch, miss === 0, null, 3);
              K.sfx.good();
              K.say(`${K.pick(PRAISE)} פוצצת את כל הבלונים!`).then(() => resolve(miss === 0));
            }
          } else {
            b.classList.remove('wobble'); void b.offsetWidth; b.classList.add('wobble'); K.sfx.soft();
            if (!miss && !recorded) { K.record(p, ch, false, b.dataset.c, 3); recorded = true; }
            miss++;
            K.say(`זה ${nameOf(b.dataset.c)}.`);
          }
        };
        b.addEventListener('animationend', (e) => { if (e.animationName === 'rise') b.remove(); });
        field.appendChild(b);
      }
      spawn(true); setTimeout(() => spawn(), 600);
      timer = setInterval(() => { if (field.childElementCount < 7) spawn($$('.balloon', field).filter((x) => x.dataset.c === ch && !x.classList.contains('popped')).length === 0); }, 1100);
    });
  }

  // צליל פותח: "באיזו אות מתחילה ___?"
  function firstSoundItem(p, word) {
    return new Promise((resolve) => {
      const info = K.wordInfo(word), ch = word[0];
      const sup = Math.max(2, K.supportFor(p, ch));
      const opts = K.shuffle([ch, ...K.distractors(p, ch, K.choiceCount(p) - 1)]);
      const id = screen(`
        <button class="pic-btn" id="pic"><span class="pic">${info.e}</span></button>
        <p class="say big">באיזו אות מתחילה ${word}?</p>
        <div class="cards n${opts.length}">${opts.map((o) => `<button class="card" data-c="${o}">${K.letterArt(o, sup)}</button>`).join('')}</div>`);
      const t = [`${word}.`, `באיזו אות מתחילה המילה ${word}?`];
      speak(t);
      $('#pic').onclick = () => K.say(word);
      choiceLogic(id, p, ch, sup, resolve, async () => {
        await K.say(`${K.pick(PRAISE)} ${word} מתחילה ב${K.LETTERS[ch].name}. ${K.LETTERS[ch].sound}… ${word}!`);
      });
    });
  }

  // הבחנה בין אותיות דומות + הסבר הפרט המבדיל
  function discriminateItem(p, pair, ch) {
    return new Promise((resolve) => {
      const sup = Math.max(2, K.supportFor(p, ch));
      const opts = K.shuffle(pair.slice());
      const L = K.LETTERS[ch];
      const id = screen(`<p class="say big">איפה ${L.name}?</p><div class="cards">${opts.map((o) => `<button class="card" data-c="${o}">${K.letterArt(o, sup)}</button>`).join('')}</div><p class="say" id="hint"></p>`);
      speak([`איפה ${L.name}?`, `${L.sound}…`]);
      choiceLogic(id, p, ch, sup, resolve, async () => {
        $$('.card').forEach((b) => { b.classList.remove('dim'); b.innerHTML = K.letterArt(b.dataset.c, 0); });
        const key = pair.slice().sort().join('|');
        const h = K.HINTS[key] || K.HINTS[pair.join('|')] || K.HINTS[[pair[1], pair[0]].join('|')];
        if (h) $('#hint').textContent = h;
        await K.sayAll([K.pick(PRAISE), h].filter(Boolean));
        await wait(500);
      });
    });
  }

  // בניית מילה: שומעים את המילה ומסדרים אותיות (מימין לשמאל)
  function buildItem(p, word) {
    return new Promise((resolve) => {
      const info = K.wordInfo(word);
      const letters = Array.from(word);
      const extra = K.shuffle(K.introduced(p).filter((x) => !letters.includes(x))).slice(0, letters.length >= 4 ? 1 : 2);
      const tiles = K.shuffle([...letters, ...extra]);
      const id = screen(`
        <button class="pic-btn" id="pic"><span class="pic">${info ? info.e : '❓'}</span></button>
        <p class="say big">בואי נכתוב: ${word}</p>
        <div class="slots">${letters.map((_, i) => `<div class="slot${i === 0 ? ' next' : ''}" data-i="${i}"></div>`).join('')}</div>
        <div class="tiles">${tiles.map((t, i) => `<button class="tile" data-c="${t}" data-k="${i}">${t}</button>`).join('')}</div>`);
      const soundHint = (i) => { const b = K.baseOf(letters[i]); return K.LETTERS[b] ? K.LETTERS[b].sound : ''; };
      speak([`בואי נכתוב ${word}.`, `מה השמיעה הראשונה? ${soundHint(0)}…`], () => K.sayAll([word, `${soundHint(pos)}…`]));
      $('#pic').onclick = () => K.say(word);
      let pos = 0, mistakes = 0;
      $$('.tile').forEach((b) => (b.onclick = async () => {
        if (!alive(id) || b.classList.contains('used')) return;
        const need = letters[pos];
        if (b.dataset.c === need) {
          K.sfx.pop();
          b.classList.add('used');
          const s = $(`.slot[data-i="${pos}"]`); s.textContent = need; s.classList.remove('next'); s.classList.add('filled');
          pos++;
          if (pos < letters.length) {
            $(`.slot[data-i="${pos}"]`).classList.add('next');
            K.say(`${soundHint(pos)}…`);
          } else {
            K.recordWord(p, mistakes <= 1);
            letters.forEach((c) => { const bc = K.baseOf(c); if (K.LETTERS[bc]) K.rec(p, bc).s = Math.min(6, K.rec(p, bc).s + 0.15); });
            K.store.save();
            K.sfx.good(); confetti(25);
            await K.sayAll([`${K.pick(PRAISE)} כתבת ${word}!`]);
            await wait(300);
            resolve(mistakes <= 1);
          }
        } else {
          mistakes++;
          const bc = K.baseOf(need);
          if (mistakes === 1 && K.LETTERS[bc]) K.record(p, bc, false, K.baseOf(b.dataset.c), 3);
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); K.sfx.soft();
          await K.say(`זאת ${nameOf(K.baseOf(b.dataset.c))}. אנחנו צריכות ${soundHint(pos)}…`);
        }
      }));
    });
  }

  // קריאת מילה: רואים מילה ובוחרים תמונה. אפשר ללחוץ על אות ולשמוע את הצליל שלה.
  function readItem(p, word) {
    return new Promise((resolve) => {
      const info = K.wordInfo(word);
      const others = K.shuffle(K.WORDS.filter((x) => x.w !== word && x.w[0] !== word[0] && x.e !== info.e)).slice(0, 2);
      const opts = K.shuffle([info, ...others]);
      const id = screen(`
        <p class="say big">מה כתוב כאן?</p>
        <div class="word-big">${Array.from(word).map((c) => `<span data-c="${c}">${c}</span>`).join('')}</div>
        <div class="pics">${opts.map((o) => `<button data-w="${o.w}" aria-label="${o.w}">${o.e}</button>`).join('')}</div>
        <p class="note">אפשר ללחוץ על אות כדי לשמוע אותה</p>`);
      speak('מה כתוב כאן? אפשר ללחוץ על כל אות ולשמוע אותה.');
      $$('.word-big span').forEach((s) => (s.onclick = () => {
        $$('.word-big span').forEach((x) => x.classList.remove('lit')); s.classList.add('lit');
        const b = K.baseOf(s.dataset.c); if (K.LETTERS[b]) K.say(K.LETTERS[b].sound);
      }));
      let tries = 0, done = false;
      $$('.pics button').forEach((b) => (b.onclick = async () => {
        if (!alive(id) || done) return;
        if (b.dataset.w === word) {
          done = true;
          if (tries === 0) K.recordWord(p, true);
          b.classList.add('good'); K.sfx.good();
          await K.say(`${K.pick(PRAISE)} כתוב ${word}!`);
          await wait(300);
          resolve(tries === 0);
        } else {
          if (tries === 0) K.recordWord(p, false);
          tries++;
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); K.sfx.soft();
          if (tries >= 2) { $(`.pics button[data-w="${word}"]`).classList.add('hint'); await K.say(`זה ${b.dataset.w}. כאן כתוב ${word}.`); }
          else await K.say(`זה ${b.dataset.w}. נסי שוב. ${K.LETTERS[K.baseOf(word[0])]?.sound || ''}…`);
        }
      }));
    });
  }

  // ---------- סיום מפגש ----------
  function endScreen(p, newCh) {
    topbar({ home: true });
    const fresh = newCh && K.LETTERS[newCh];
    const tips = parentIdeas(p, newCh);
    screen(`
      ${owlSays(fresh ? `${K.LETTERS[newCh].word} עבר לגור בכפר שלך!` : 'איזה משחק! נוגה הולכת לנוח', 'sleep')}
      ${newCh ? `<div class="hero pop" style="width:clamp(180px,34vmin,280px)">${K.letterArt(newCh, K.LETTERS[newCh] ? 0 : 2)}</div>` : ''}
      <div class="row"><button class="btn white" id="village">🏡 לכפר שלי</button><button class="btn teal" id="home">🏠 הביתה</button></div>
      <p class="parent-tip"><b>רעיון להורים:</b> ${esc(tips)}</p>`);
    K.sfx.fanfare(); confetti();
    speak([`כל הכבוד ${p.name}!`, fresh ? `ה${K.LETTERS[newCh].word} עבר לגור בכפר האותיות שלך.` : 'שיחקת יפה מאוד.', 'נוגה הולכת לנוח. נתראה מחר!']);
    $('#village').onclick = () => { K.sfx.tap(); villageScreen(newCh); };
    $('#home').onclick = () => { K.sfx.tap(); childHome(); };
  }

  function parentIdeas(p, ch) {
    const L = ch && K.LETTERS[ch];
    const conf = topConfusion(p);
    const ideas = [];
    if (L) ideas.push(`חפשו יחד את האות ${ch} בשלטים בדרך לגן, ועשו את התנועה: ${L.move}.`);
    if (L) ideas.push(`שאלו "מה עוד מתחיל בצליל ${L.sound}?" ותנו כמה דוגמאות.`);
    if (conf) ideas.push(`${p.name} מתבלבלת לפעמים בין ${conf[0]} ל${conf[1]}. ציירו את שתיהן ודברו על מה שמבדיל ביניהן.`);
    ideas.push('כתבו את האות בחול, בקצף גילוח או בפלסטלינה.');
    return ideas[0] + (ideas[1] ? ' ' + ideas[1] : '');
  }
  function topConfusion(p) {
    let best = null, n = 0;
    for (const ch of K.ORDER) {
      const r = K.rec(p, ch);
      for (const [o, c] of Object.entries(r.conf || {})) if (c > n) { n = c; best = [ch, o]; }
    }
    return n >= 2 ? best : null;
  }

  // ---------- הכפר ----------
  function villageScreen(highlight) {
    topbar({ back: childHome });
    const p = cur;
    const intro = K.introduced(p);
    const empties = K.ORDER.length - intro.length;
    const fins = Object.keys(K.FINALS).filter((f) => K.rec(p, f).intro);
    screen(`
      <p class="say big">כפר האותיות של ${esc(p.name)}</p>
      <div class="village">
        ${intro.map((ch, i) => {
          const f = fins.find((x) => K.FINALS[x].base === ch);
          return `<button class="house${ch === highlight ? ' enter' : ''}" data-c="${ch}" style="--h:${HOUSE_COLORS[i % HOUSE_COLORS.length]}" aria-label="${K.LETTERS[ch].word}">${K.letterArt(ch, 0)}${f ? `<span class="fin">${f}</span>` : ''}</button>`;
        }).join('')}
        ${'<div class="house empty">?</div>'.repeat(empties)}
      </div>`);
    speak(intro.length ? 'לחצי על בית, ותשמעי מי גר בו.' : 'הכפר מחכה לאותיות!');
    $$('.house[data-c]').forEach((b) => (b.onclick = () => {
      const L = K.LETTERS[b.dataset.c];
      K.sfx.tap();
      b.classList.remove('enter'); void b.offsetWidth; b.classList.add('enter');
      K.sayAll([`${L.name}. ${L.sound}. ${L.word}.`]);
    }));
  }

  // ---------- משחקות ביחד ----------
  function coopSetup() {
    const placed = K.profiles().filter((p) => p.placementDone);
    if (placed.length === 2) return coopRun(placed[0], placed[1]);
    topbar({ back: welcome });
    const sel = [];
    screen(`${owlSays('מי משחקת ביחד? בחרו שתיים')}<div class="players">${placed.map((p) => `<button class="player" data-id="${p.id}"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}</span></button>`).join('')}</div>`);
    speak('מי משחקת ביחד? בחרו שתיים.');
    $$('.player').forEach((b) => (b.onclick = () => {
      K.sfx.pop(); b.style.boxShadow = '0 0 0 6px var(--coral)';
      if (!sel.includes(b.dataset.id)) sel.push(b.dataset.id);
      if (sel.length === 2) coopRun(K.getProfile(sel[0]), K.getProfile(sel[1]));
    }));
  }

  async function coopRun(a, b) {
    cur = null;
    const items = K.planCoop(a, b, 6);
    const RB = ['#ff5c5c', '#ff9f3d', '#ffd84a', '#7bd36b', '#4fb3e8', '#7c6bff', '#c86bff'];
    const n = items.length;
    const rainbowHtml = (k) => `<div class="rainbow">${Array.from({ length: n }, (_, i) => `<i style="${i < k ? `background:${RB[i % RB.length]}` : ''}"></i>`).join('')}</div>`;
    topbar({ back: () => { cur = null; welcome(); } });
    screen(`${owlSays(`${a.name} ו${b.name}, בונות ביחד קשת!`)}<div class="row"><span style="font-size:80px">${a.avatar}</span><span style="font-size:60px">🌈</span><span style="font-size:80px">${b.avatar}</span></div><button class="btn huge pulse" id="go">▶ מתחילות</button>`);
    speak(`${a.name} ו${b.name}! משחקות בתורות, ובכל תשובה בונות ביחד קשת.`);
    await new Promise((r) => ($('#go').onclick = () => { K.unlockAudio(); K.sfx.tap(); r(); }));
    for (let i = 0; i < n; i++) {
      const it = items[i], who = it.who === a.id ? a : b;
      topbar({ back: () => { cur = null; welcome(); } });
      $('#topbar .grow').innerHTML = rainbowHtml(i);
      const id = screen(`<div class="turn"><span class="av">${who.avatar}</span> תור של ${esc(who.name)}!</div>`);
      await K.say(`תור של ${who.name}!`);
      await wait(400);
      if (!alive(id)) return;
      const ok = await runItem(who, it);
      if (ok === null) return;
    }
    $('#topbar .grow').innerHTML = rainbowHtml(n);
    screen(`${owlSays('בניתן ביחד קשת שלמה!')}<div class="row"><span style="font-size:80px">${a.avatar}</span><span style="font-size:100px">🌈</span><span style="font-size:80px">${b.avatar}</span></div><button class="btn teal" id="home">🏠 הביתה</button>`);
    K.sfx.fanfare(); confetti(90);
    speak(`וואו! ${a.name} ו${b.name} בנו ביחד קשת שלמה! איזה צוות!`);
    [a, b].forEach((p) => { p.lastPlayed = Date.now(); }); K.store.save();
    $('#home').onclick = () => { K.sfx.tap(); welcome(); };
  }

  // ---------- אזור הורים ----------
  function parentGate() {
    const back = cur ? childHome : welcome;
    topbar({ back, speaker: false });
    screen(`<p class="say big">אזור הורים</p><button class="gate-btn" id="gate" aria-label="להחזיק 3 שניות"><span class="fill"></span>🔒</button><p class="note">כדי להיכנס, לוחצים על המנעול ומחזיקים 3 שניות.</p>`);
    const g = $('#gate'); let t;
    const start = (e) => { e.preventDefault(); g.classList.add('holding'); t = setTimeout(() => parentArea(), 3000); };
    const stop = () => { g.classList.remove('holding'); clearTimeout(t); };
    g.onpointerdown = start; g.onpointerup = g.onpointerleave = g.onpointercancel = stop;
    g.onkeydown = (e) => { if (e.key === 'Enter') parentArea(); };
  }

  function parentArea(selId) {
    const back = cur ? childHome : welcome;
    topbar({ back, speaker: false });
    const profs = K.profiles();
    const p = (selId && K.getProfile(selId)) || cur || profs[0];
    const st = K.store.load().settings;
    let body = '';
    if (p) {
      const intro = K.introduced(p), known = K.knownLetters(p), mast = K.masteredLetters(p);
      const recent = p.history.slice(-5);
      const acc = recent.reduce((a, h) => a + h.right, 0) / Math.max(1, recent.reduce((a, h) => a + h.total, 0));
      const confs = [];
      for (const ch of K.ORDER) for (const [o, c] of Object.entries(K.rec(p, ch).conf || {})) if (c >= 1) confs.push([ch, o, c]);
      confs.sort((x, y) => y[2] - x[2]);
      const next = K.nextNewLetter(p);
      const cell = (ch) => {
        const r = K.rec(p, ch);
        const cls = !r.intro && r.s === 0 ? '' : r.s < 2 ? 's1' : r.s < 3.5 ? 's2' : r.s < 5 ? 's3' : 's4';
        return `<div class="lcell ${cls}"><span class="ch">${ch}</span><small>${r.n ? `${r.c}/${r.n}` : '–'}</small></div>`;
      };
      body = `
        <h2>${p.avatar} ${esc(p.name)}</h2>
        <div class="stat-row">
          <div class="stat"><b>שלב ${K.stage(p)}</b><span>${K.STAGE_NAMES[K.stage(p)]}</span></div>
          <div class="stat"><b>${known.length}/22</b><span>אותיות מוכרות</span></div>
          <div class="stat"><b>${mast.length}</b><span>יציבות בלי ציור</span></div>
          <div class="stat"><b>${p.sessions}</b><span>מפגשים</span></div>
          <div class="stat"><b>${recent.length ? Math.round(acc * 100) + '%' : '–'}</b><span>הצלחה ב-5 מפגשים אחרונים</span></div>
        </div>
        <p>${next ? `האות הבאה שתילמד: <b style="font-size:22px">${next}</b> (${K.LETTERS[next].word}).` : 'כל 22 האותיות הוצגו. עכשיו יש חזרה, אותיות סופיות ומילים.'}
        ${p.placement ? ` בבוחן הפתיחה: ${p.placement.right} מתוך ${p.placement.tested} אותיות, מילים ${p.placement.words}.` : ''}</p>
        <h3>מצב האותיות (נכון/ניסיונות)</h3>
        <div class="lgrid">${K.ORDER.map(cell).join('')}</div>
        <div class="lgrid" style="margin-top:8px">${Object.keys(K.FINALS).map(cell).join('')}</div>
        <div class="legend"><span><i style="background:#f0eef5"></i>עוד לא</span><span><i style="background:#ffe1dc"></i>חדשה</span><span><i style="background:#fff0c7"></i>בדרך</span><span><i style="background:#dff5d8"></i>מוכרת</span><span><i style="background:#b9ebb0"></i>יציבה</span></div>
        <h3>בלבולים</h3>
        <p>${confs.length ? confs.slice(0, 6).map(([a, b, c]) => `בחרה <b>${b}</b> במקום <b>${a}</b>: ${c === 1 ? 'פעם אחת' : c + ' פעמים'}`).join(' · ') : 'אין בלבולים חוזרים כרגע.'}</p>
        <h3>שלב (אוטומטי לפי ההתקדמות)</h3>
        <div class="prow">${['auto', 1, 2, 3, 4].map((s) => `<button class="pbtn${(p.stageOverride || 'auto') === s ? ' on' : ''}" data-stage="${s}">${s === 'auto' ? 'אוטומטי' : 'שלב ' + s}</button>`).join('')}</div>
        <h3>גיבוי והעברה למכשיר אחר</h3>
        <div class="prow"><button class="pbtn" id="exp">יצירת קוד גיבוי</button></div>
        <textarea id="exp-code" readonly hidden aria-label="קוד גיבוי"></textarea>
        <div class="prow"><button class="pbtn" id="replace">בוחן פתיחה מחדש</button><button class="pbtn danger" id="del">מחיקת ${esc(p.name)}</button></div>
        <div id="confirm"></div>`;
    }
    screen(`<div class="parent">
      <div class="ptabs">${profs.map((x) => `<button data-id="${x.id}" class="${p && x.id === p.id ? 'on' : ''}">${x.avatar} ${esc(x.name)}</button>`).join('')}</div>
      ${body || '<p>עדיין אין שחקניות.</p>'}
      <h3>הגדרות</h3>
      <div class="prow">אורך מפגש: ${[[8, 'קצר'], [12, 'רגיל'], [16, 'ארוך']].map(([n, l]) => `<button class="pbtn${st.items === n ? ' on' : ''}" data-items="${n}">${l}</button>`).join('')}</div>
      <div class="prow">קריינות: <button class="pbtn${st.voice !== false ? ' on' : ''}" data-voice="1">פועלת</button><button class="pbtn${st.voice === false ? ' on' : ''}" data-voice="0">כבויה</button><button class="pbtn" id="test-voice">בדיקת קול</button></div>
      ${K.hasHebrewVoice() ? '' : '<p style="color:#a2321c">לא נמצא במכשיר קול בעברית. באייפד: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← עברית. בינתיים אפשר להקריא לילדות את הטקסט שעל המסך.</p>'}
      <h3>שחזור מקוד גיבוי</h3>
      <textarea id="imp-code" aria-label="הדבקת קוד גיבוי" placeholder="מדביקים כאן קוד גיבוי"></textarea>
      <div class="prow"><button class="pbtn" id="imp">שחזור</button><span id="imp-msg"></span></div>
      <h3>איך המשחק בנוי</h3>
      <ul>
        <li><b>תומך זיכרון משובץ:</b> כל אות מצוירת כחלק מחפץ ששמו מתחיל בצליל שלה (ב בתוך בית, פ שהיא פיל). הציור דוהה בהדרגה עד שנשארת אות רגילה, והאות נחשבת יציבה רק כשמזהים אותה בלי ציור.</li>
        <li><b>אות חדשה בכל מפגש,</b> עם חזרה מרווחת. אותיות שהיו בהן טעויות חוזרות יותר. קודם האותיות שבשמות (ל נמצאת גם ביובל וגם בעלמה), ואותיות דומות (ב/כ, ד/ר, ה/ח/ת) נלמדות במרחק זו מזו ואחר כך מתורגלות כזוג.</li>
        <li><b>שם וצליל יחד.</b> תשובה בהברה ("לה") נחשבת נכונה. סופיות ומילים מגיעות בשלב מאוחר.</li>
        <li><b>בלי תחרות:</b> הילדות לא רואות שלבים, ניקוד או השוואה. לכל אחת כפר משלה. במשחק ביחד בונים קשת משותפת.</li>
        <li><b>10–15 דקות ביום</b> מספיקות. המפגש נגמר כשנוגה הולכת לנוח. כדאי לשבת ליד הילדות ולעשות יחד את התנועות.</li>
      </ul>
    </div>`);
    $$('.ptabs button').forEach((b) => (b.onclick = () => parentArea(b.dataset.id)));
    $$('[data-items]').forEach((b) => (b.onclick = () => { st.items = +b.dataset.items; K.store.save(); parentArea(p && p.id); }));
    $$('[data-voice]').forEach((b) => (b.onclick = () => { st.voice = b.dataset.voice === '1'; K.store.save(); parentArea(p && p.id); }));
    $('#test-voice').onclick = () => { K.unlockAudio(); K.say('שלום! אני נוגה הינשופה. בֵּית, בָּה, בַּיִת.'); };
    $('#imp').onclick = () => {
      try { const np = K.importProfile($('#imp-code').value); $('#imp-msg').textContent = `שוחזר: ${np.name}`; setTimeout(() => parentArea(np.id), 700); }
      catch (e) { $('#imp-msg').textContent = 'הקוד לא תקין. בדקו שהעתקתם את כולו.'; }
    };
    if (!p) return;
    $$('[data-stage]').forEach((b) => (b.onclick = () => { const v = b.dataset.stage; p.stageOverride = v === 'auto' ? null : +v; K.store.save(); parentArea(p.id); }));
    $('#exp').onclick = async () => {
      const ta = $('#exp-code'); ta.hidden = false; ta.value = K.exportProfile(p); ta.select();
      try { await navigator.clipboard.writeText(ta.value); $('#exp').textContent = 'הקוד הועתק ✓'; } catch (e) { $('#exp').textContent = 'סמנו והעתיקו את הקוד'; }
    };
    $('#replace').onclick = () => {
      $('#confirm').innerHTML = `<div class="prow">לעשות שוב את בוחן הפתיחה? הנתונים הקיימים יתעדכנו לפי התוצאות. <button class="pbtn on" id="yes-pl">כן</button><button class="pbtn" id="no-c">ביטול</button></div>`;
      $('#yes-pl').onclick = () => { cur = p; p.placementDone = false; K.store.save(); placementIntro(); };
      $('#no-c').onclick = () => ($('#confirm').innerHTML = '');
    };
    $('#del').onclick = () => {
      $('#confirm').innerHTML = `<div class="prow">למחוק את ${esc(p.name)} וכל ההתקדמות? אי אפשר לבטל. <button class="pbtn danger" id="yes-del">מחיקה</button><button class="pbtn" id="no-c">ביטול</button></div>`;
      $('#yes-del').onclick = () => { K.deleteProfile(p.id); if (cur && cur.id === p.id) cur = null; parentArea(); };
      $('#no-c').onclick = () => ($('#confirm').innerHTML = '');
    };
  }

  // ---------- התחלה ----------
  function boot() {
    const clouds = Array.from({ length: 5 }, (_, i) =>
      `<div class="cloud" style="top:${6 + i * 9}vh;width:${90 + i * 25}px;height:${28 + i * 6}px;animation-duration:${55 + i * 18}s;animation-delay:${-i * 17}s"></div>`).join('');
    $('#world').innerHTML = `<div class="sun-bg"></div>${clouds}
      <svg class="hills" viewBox="0 0 1000 260" preserveAspectRatio="none"><path d="M0 140 Q180 40 380 120 T760 100 T1000 110 V260 H0Z" fill="#a6e38a"/><path d="M0 190 Q220 110 470 180 T1000 160 V260 H0Z" fill="#8fd86f"/><path d="M0 230 Q300 180 600 225 T1000 215 V260 H0Z" fill="#6cc257"/></svg>`;
    welcome();
  }
  K.boot = boot;
  document.addEventListener('DOMContentLoaded', boot);
})();
