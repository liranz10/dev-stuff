/* קול: הקראה בעברית (speechSynthesis) וצלילי משוב קצרים (WebAudio) */
(function () {
  const K = window.K;
  const synth = window.speechSynthesis;
  let voice = null;

  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices();
    const he = vs.filter((v) => /^he|^iw/i.test(v.lang));
    // עדיפות לקול נשי/טבעי אם יש (Carmit ב-iOS)
    voice = he.find((v) => /carmit|google|natural|online/i.test(v.name)) || he[0] || null;
    return voice;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  K.hasHebrewVoice = () => !!(voice || pickVoice());

  let token = 0;
  K.stopSpeech = () => { token++; try { synth && synth.cancel(); } catch (e) { /* */ } };

  // מחזיר הבטחה שמתממשת בסוף ההקראה (או אחרי זמן מקסימלי – יש דפדפנים שלא שולחים onend)
  K.say = function (text, opts = {}) {
    const st = K.store.load().settings;
    if (!synth || !text || st.voice === false) return Promise.resolve();
    const my = ++token;
    try { synth.cancel(); } catch (e) { /* */ }
    return new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL';
      if (voice || pickVoice()) u.voice = voice;
      u.rate = opts.rate || 0.88;
      u.pitch = opts.pitch || 1.08;
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 1500 + text.length * 110);
      if (my !== token) return fin();
      try { synth.speak(u); } catch (e) { fin(); }
    });
  };
  // רצף משפטים; נעצר אם התחילה הקראה אחרת
  K.sayAll = async function (parts) {
    for (const t of parts) {
      const pr = K.say(t);
      const mine = token;
      await pr;
      if (token !== mine) return;
      await new Promise((r) => setTimeout(r, 220));
      if (token !== mine) return;
    }
  };
  // "פתיחת" הקול ב-iOS – חייב לקרות בתוך לחיצה
  K.unlockAudio = function () {
    try { if (synth) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch (e) { /* */ }
    ctx();
  };

  // ---------- צלילים ----------
  let ac = null;
  function ctx() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
    return ac;
  }
  function tone(freq, start, dur, type = 'sine', vol = 0.18) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + start);
    g.gain.setValueAtTime(0, a.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.05);
  }
  K.sfx = {
    good() { tone(660, 0, 0.18, 'triangle'); tone(880, 0.1, 0.22, 'triangle'); tone(1320, 0.2, 0.3, 'sine', 0.12); },
    soft() { tone(392, 0, 0.25, 'sine', 0.12); tone(330, 0.12, 0.3, 'sine', 0.1); },
    tap() { tone(520, 0, 0.08, 'sine', 0.1); },
    pop() { tone(900, 0, 0.06, 'square', 0.08); tone(1400, 0.03, 0.08, 'sine', 0.1); },
    whoosh() { [300, 420, 560, 740].forEach((f, i) => tone(f, i * 0.05, 0.15, 'sine', 0.07)); },
    fanfare() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.25, 'triangle', 0.14)); },
    magic() { [880, 1108, 1318, 1760, 2217].forEach((f, i) => tone(f, i * 0.07, 0.3, 'sine', 0.08)); },
  };
})();
