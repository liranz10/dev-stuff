// 🧹 Cleaning: jobs appear as cards (a whole room after a guest leaves, or a guest's request).
// Each job is a little game on a picture of the room: wipe the dust, make the bed, fold the towels,
// throw out the rubbish. Then (optionally) a real mission at home.
import { h, tap, reconcile, fly, rectOf, confetti, sparkles, wiggle, bounce, flyStars, speaker, wait } from './ui.js';
import { sfx, say } from './audio.js';
import { job, room as roomInfo, REAL_TASKS, pick } from './data.js';
import { roomScene } from './art.js';

export function houseScreen({ hotel, store }) {
  const cards = h('div.h-cards');
  const idle = h('div.h-idle', h('div.h-cart', '🧹🧺🧽'), h('div.h-idle-t', 'הכול מבריק! מחכים לעבודה…'));
  const el = h('div.house', h('div.h-bg'), cards, idle);
  let work = null;

  function cardEl(t) {
    const info = roomInfo(t.room);
    const c = h('button.h-card', { style: { '--c': info.color, '--cl': info.light, '--cd': info.dark } },
      h('div.hc-door', h('span.hc-sym', info.sym), h('b', info.n)),
      h('div.hc-jobs'),
      h('div.hc-tag'),
    );
    tap(c, () => startJob(t.id), 'pop');
    return c;
  }
  function updateCard(c, t) {
    const sig = t.jobs.join();
    const jobsEl = c.querySelector('.hc-jobs');
    if (jobsEl.dataset.sig !== sig) { jobsEl.dataset.sig = sig; jobsEl.innerHTML = ''; jobsEl.append(...t.jobs.map(j => h('span', job(j).e))); }
    c.querySelector('.hc-tag').textContent = t.turnover ? '🧳 אורח יצא' : '🛎️ בקשה';
    c.classList.toggle('turnover', !!t.turnover);
    const g = hotel.guest(t.gid);
    c.classList.toggle('kid', !!(g && !g.npc));
  }

  function update() {
    const tks = hotel.tickets('house');
    reconcile(cards, tks, t => t.id, cardEl, updateCard);
    idle.style.display = tks.length ? 'none' : '';
    if (tks.length > (update.last || 0)) { sfx('ding'); if (!work) say('יש עבודה חדשה!'); }
    update.last = tks.length;
  }

  // ========================================================== doing the jobs of one card
  async function startJob(id) {
    const t = hotel.s.get('tk:' + id);
    if (!t || work) return;
    const info = roomInfo(t.room);
    const r = hotel.room(t.room);
    if (r.dnd && !t.turnover) { say('יש שלט לא להפריע! חוזרים אחר כך'); toast2('🚫'); return; }
    store.patch('tk:' + id, { cleaner: store.id });
    const jobs = [...t.jobs].sort((a, b) => ['trash', 'dust', 'bed', 'towels'].indexOf(a) - ['trash', 'dust', 'bed', 'towels'].indexOf(b));
    const dots = h('div.jobdots', jobs.map(j => h('span', job(j).e)));
    const title = h('div.jt');
    const stageWrap = h('div.j-stage');
    const v = h('div.work.jobwork', { style: { '--c': info.color, '--cl': info.light } },
      h('div.w-head', { style: { '--c': info.color } }, tap(h('button.w-back', '↩️'), () => { v.remove(); work = null; }), h('div.w-order', h('span.w-sym', info.sym), h('span', info.thing)), dots),
      title, stageWrap);
    el.append(v);
    work = { id, el: v };
    for (let i = 0; i < jobs.length; i++) {
      if (!v.isConnected) return;
      dots.children[i].classList.add('now');
      const j = job(jobs[i]);
      title.innerHTML = '';
      title.append(h('span', j.e + ' ' + j.name), speaker(INSTR[j.id]));
      say(INSTR[j.id]);
      const scene = roomScene(t.room);
      scene.classList.add('cleaning');
      stageWrap.innerHTML = '';
      stageWrap.append(scene);
      await GAMES[j.id](scene);
      if (!v.isConnected) return;
      dots.children[i].classList.remove('now');
      dots.children[i].classList.add('done');
      sfx('yay');
      const rr = rectOf(scene);
      sparkles(rr.x, rr.y, 18);
      say(pick(['מעולה!', 'כל הכבוד!', 'איזה יופי!', 'מבריק!']));
      await wait(1100);
    }
    if (!v.isConnected) return;
    // a real job at home
    if (hotel.cfg().real) {
      const rt = REAL_TASKS[pick(jobs)];
      await new Promise(res => {
        stageWrap.innerHTML = '';
        title.innerHTML = '';
        title.append(h('span', '🏠 משימה אמיתית!'), speaker(rt.say));
        stageWrap.append(h('div.real-big', h('div.rb-e', rt.e), h('div.rb-t', rt.text),
          tap(h('button.big-go', '✔ עשיתי!'), res, 'yay'),
          tap(h('button.small-btn', 'אחר כך'), res)));
        say(rt.say);
      });
    }
    if (!v.isConnected) return;
    // done: the room sparkles
    hotel.ticketDone(id);
    const k = t.turnover ? 2 : 1;
    hotel.addStars(k);
    stageWrap.innerHTML = '';
    const sp = h('div.shiny', { style: { '--c': info.color } }, h('div.sh-door', info.sym), h('div.sh-t', 'מבריק!'));
    stageWrap.append(sp);
    sfx('sparkle');
    say(t.turnover ? `${info.thing} נקי ומוכן לאורח חדש!` : `${info.thing} מסודר! תודה!`);
    confetti(rectOf(sp).x, rectOf(sp).y, 70);
    await flyStars(k, rectOf(sp), document.querySelector('.jar'));
    await wait(800);
    v.remove();
    work = null;
    update();
  }

  function toast2(e) { const x = h('div.toast', h('div.toast-e', e)); document.getElementById('fx').append(x); setTimeout(() => { x.classList.add('out'); setTimeout(() => x.remove(), 500); }, 1200); }

  return { el, update, destroy() { } };
}

const INSTR = {
  dust: 'מנגבים את כל האבק עם הספוג! משפשפים עם האצבע',
  bed: 'מסדרים את המיטה! מושכים את השמיכה למעלה ושמים את הכריות',
  towels: 'מקפלים את המגבות! לוחצים על כל מגבת',
  trash: 'זורקים את הלכלוך לפח! לוחצים על כל דבר על הרצפה',
};

// ================================================================ the four little games
const GAMES = {
  // wipe the dust off with a finger (a scratch-off canvas over the room)
  dust(scene) {
    return new Promise(res => {
      const cv = h('canvas.dust-canvas');
      const sponge = h('div.sponge', '🧽');
      scene.append(cv, sponge);
      const bits = h('div.dust-bits', Array.from({ length: 5 }, (_, i) => h('span', { style: { left: 12 + i * 17 + '%', top: 20 + (i % 3) * 22 + '%' } }, pick(['🕸️', '💨', '🕸️']))));
      scene.append(bits);
      requestAnimationFrame(() => {
        const r = scene.getBoundingClientRect();
        const dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = r.width * dpr; cv.height = r.height * dpr;
        const c = cv.getContext('2d');
        c.scale(dpr, dpr);
        // a dusty grey-brown layer with blotches
        c.fillStyle = 'rgba(150,130,110,0.55)';
        c.fillRect(0, 0, r.width, r.height);
        for (let i = 0; i < 60; i++) {
          const x = Math.random() * r.width, y = Math.random() * r.height, rad = 20 + Math.random() * 70;
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, `rgba(${110 + Math.random() * 40},${95 + Math.random() * 30},${80},0.5)`);
          g.addColorStop(1, 'rgba(120,100,80,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
        }
        for (let i = 0; i < 25; i++) { c.fillStyle = 'rgba(90,70,50,0.45)'; c.beginPath(); c.arc(Math.random() * r.width, Math.random() * r.height, 3 + Math.random() * 8, 0, 7); c.fill(); }
        c.globalCompositeOperation = 'destination-out';
        let last = null, strokes = 0, finished = false;
        const R = Math.max(34, r.width / 14);
        const at = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
        const rub = (p) => {
          c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = R * 2;
          c.beginPath();
          if (last) { c.moveTo(last.x, last.y); c.lineTo(p.x, p.y); c.stroke(); }
          c.beginPath(); c.arc(p.x, p.y, R, 0, 7); c.fill();
          last = p;
          sponge.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%) rotate(${(strokes % 20) - 10}deg)`;
          if (++strokes % 4 === 0) sfx('scrub');
          if (strokes % 7 === 0) { const b = cv.getBoundingClientRect(); sparkles(b.left + p.x, b.top + p.y, 2, ['🫧']); }
          if (strokes % 12 === 0) check();
        };
        const check = () => {
          if (finished) return;
          const img = c.getImageData(0, 0, cv.width, cv.height).data;
          let left = 0, total = 0;
          const step = 16 * dpr;
          for (let y = 0; y < cv.height; y += step) for (let x = 0; x < cv.width; x += step) { total++; if (img[(Math.floor(y) * cv.width + Math.floor(x)) * 4 + 3] > 30) left++; }
          // the stubborn bits disappear with the dust
          const frac = left / total;
          bits.style.opacity = Math.min(1, frac * 1.6);
          if (frac < 0.14) {
            finished = true;
            cv.style.transition = 'opacity .6s'; cv.style.opacity = 0;
            bits.style.opacity = 0;
            sponge.remove();
            setTimeout(() => { cv.remove(); bits.remove(); res(); }, 600);
          }
        };
        cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); last = null; rub(at(e)); sponge.classList.add('on'); });
        cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') rub(at(e)); });
        cv.addEventListener('pointerup', () => { last = null; check(); });
      });
    });
  },

  // pull the blanket up, then put both pillows on the bed
  bed(scene) {
    return new Promise(res => {
      scene.classList.add('messy');
      const blanket = scene.querySelector('.blanket');
      const pillows = [...scene.querySelectorAll('.pillow')];
      const arrow = h('div.pull-hint', '👆');
      scene.querySelector('.bed').append(arrow);
      let stage = 0;
      let y0 = null;
      const fix = () => {
        if (stage) return;
        stage = 1;
        arrow.remove();
        blanket.classList.add('fixed');
        sfx('fluff');
        say('עכשיו הכריות!');
        pillows.forEach(p => p.classList.add('tapme'));
      };
      blanket.addEventListener('pointerdown', (e) => { y0 = e.clientY; blanket.setPointerCapture(e.pointerId); });
      blanket.addEventListener('pointermove', (e) => { if (y0 != null && y0 - e.clientY > 25) fix(); });
      blanket.addEventListener('pointerup', () => { if (y0 != null) fix(); y0 = null; });
      let fluffed = 0;
      pillows.forEach(p => tap(p, () => {
        if (!stage) { wiggle(blanket); say('קודם מושכים את השמיכה למעלה'); return; }
        if (p.classList.contains('placed')) return;
        p.classList.remove('tapme');
        p.classList.add('placed');
        sfx('fluff');
        const r = rectOf(p); sparkles(r.x, r.y, 5, ['☁️', '✨']);
        if (++fluffed === pillows.length) { scene.classList.remove('messy'); setTimeout(res, 700); }
      }, null));
    });
  },

  // three crumpled towels on the floor: tap each one to fold it and put it on the shelf
  towels(scene) {
    return new Promise(res => {
      const colors = ['#fff', 'var(--cl)', '#dff4ff'];
      const shelf = h('div.towel-shelf');
      scene.append(shelf);
      let done = 0;
      colors.forEach((col, i) => {
        const tw = h('button.towel-mess', { style: { '--tw': col, left: 18 + i * 26 + '%', '--r': (i * 37 % 30 - 15) + 'deg' } }, h('i'));
        tw.dataset.fold = 0;
        scene.append(tw);
        tap(tw, async () => {
          const f = +tw.dataset.fold + 1;
          tw.dataset.fold = f;
          sfx('fluff');
          if (f >= 2) {
            tw.disabled = true;
            await wait(250);
            const to = rectOf(shelf);
            tw.style.visibility = 'hidden';
            await fly(h('span.towel-fly', { style: { background: col } }), rectOf(tw), { x: to.x, y: to.y - done * 12 }, { size: 20, duration: 600 });
            shelf.append(h('span.folded', { style: { background: col } }));
            sfx('pop');
            if (++done === colors.length) setTimeout(res, 500);
          }
        }, null);
      });
    });
  },

  // tap the rubbish on the floor and it flies into the bin
  trash(scene) {
    return new Promise(res => {
      const bin = h('div.bin', h('div.bin-lid'), h('div.bin-body', '🗑️'));
      scene.append(bin);
      const items = ['🍌', '📄', '🥤', '🍂', '🧃', '🍬'].sort(() => Math.random() - 0.5).slice(0, 5);
      let left = items.length;
      items.forEach((e, i) => {
        const it = h('button.junk', { style: { left: 8 + i * 17 + Math.random() * 5 + '%', top: 64 + (i % 2) * 14 + Math.random() * 6 + '%', '--r': Math.random() * 60 - 30 + 'deg' } }, e);
        scene.append(it);
        tap(it, async () => {
          if (it.disabled) return;
          it.disabled = true;
          it.style.visibility = 'hidden';
          await fly(e, rectOf(it), rectOf(bin), { size: 48, spin: 540, arc: -160, duration: 650 });
          sfx('trash');
          bounce(bin);
          if (--left === 0) setTimeout(res, 400);
        }, 'whoosh');
      });
    });
  },
};
