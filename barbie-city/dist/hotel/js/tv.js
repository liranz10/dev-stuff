// 📺 The big hotel screen (nice on a TV or a laptop): the whole building, who is in which room,
// what they asked for, the star jar and the latest news.
import { h, tap, confetti, sparkles, rectOf } from './ui.js';
import { sfx } from './audio.js';
import { PRIZES, nextPrize, prizesFor } from './data.js';
import { facade, updateFacade } from './art.js';

export function tvScreen({ hotel }) {
  const stage = facade();
  const news = h('div.tv-news');
  const bigStars = h('div.tv-stars', h('div.tvs-n'), h('div.tvs-bar', h('i')), h('div.tvs-prizes'));
  const el = h('div.tv', h('div.tv-stage', stage), h('div.tv-side', bigStars, h('div.tv-news-t', '📰 חדשות המלון'), news));
  let night = false;
  let forced = null;

  tap(stage, (e) => {
    // tapping the sky switches day and night
    const r = stage.getBoundingClientRect();
    if (e.clientY - r.top < r.height * 0.25) { forced = !(forced ?? night); sfx('whoosh'); update(); }
    else { sparkles(e.clientX, e.clientY, 8); }
  }, 'pop');

  setTimeout(() => addNews('🏨', 'ברוכים הבאים למלון הכוכבים!'), 50);

  function update() {
    const occ = hotel.rooms().filter(r => hotel.guestIn(r.n));
    const asleep = occ.filter(r => r.sleep).length;
    night = forced ?? (occ.length > 0 && asleep * 2 >= occ.length);
    updateFacade(stage, hotel, { night });
    const n = hotel.stars();
    const p = nextPrize(n);
    const prev = [...PRIZES].reverse().find(x => n >= x.at);
    const from = prev ? prev.at : 0;
    bigStars.querySelector('.tvs-n').textContent = `⭐ ${n}`;
    bigStars.querySelector('.tvs-bar i').style.width = p ? `${((n - from) / (p.at - from)) * 100}%` : '100%';
    const got = prizesFor(n);
    const pr = bigStars.querySelector('.tvs-prizes');
    const sig = got.join() + '|' + (p ? p.id : '');
    if (pr.dataset.sig !== sig) {
      pr.dataset.sig = sig;
      pr.innerHTML = '';
      for (const x of PRIZES) pr.append(h('span' + (got.includes(x.id) ? '.got' : x === p ? '.next' : ''), x.e));
    }
  }

  function addNews(e, text) {
    const item = h('div.news-item', h('span.ni-e', e), h('span', text));
    news.prepend(item);
    while (news.children.length > 6) news.lastChild.remove();
  }

  return {
    el,
    update,
    onEvent(ev) {
      if (ev.type === 'news') { addNews(ev.e, ev.text); sfx('tap'); }
      if (ev.type === 'bell') sfx('bell');
      if (ev.type === 'prize') setTimeout(() => confetti(), 300);
      if (ev.type === 'knock') {
        const w = stage.querySelector(`.win[data-n="${ev.room}"]`);
        if (w) { const r = rectOf(w); sparkles(r.x, r.y, 8, ['🛎️', '✨']); }
      }
    },
  };
}
