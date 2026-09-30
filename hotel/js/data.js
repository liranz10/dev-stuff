// Everything the hotel is made of: rooms, guests, food, cleaning jobs and prizes.
// Lines that are spoken out loud avoid gendered Hebrew forms, so they suit every child.

export const ROOMS = [
  { n: 1, color: '#ff7eb6', light: '#ffe0ef', dark: '#d94a8c', sym: '🌸', name: 'הוורוד', thing: 'חדר הפרח' },
  { n: 2, color: '#ffc93c', light: '#fff4cc', dark: '#d99a00', sym: '☀️', name: 'הצהוב', thing: 'חדר השמש' },
  { n: 3, color: '#4fb8ff', light: '#dcf1ff', dark: '#1f86d1', sym: '🐟', name: 'הכחול', thing: 'חדר הדג' },
  { n: 4, color: '#5fd068', light: '#e0f8e2', dark: '#2f9e3a', sym: '🌳', name: 'הירוק', thing: 'חדר העץ' },
  { n: 5, color: '#ff6b5e', light: '#ffe2df', dark: '#d63a2e', sym: '❤️', name: 'האדום', thing: 'חדר הלב' },
  { n: 6, color: '#a77bff', light: '#eee5ff', dark: '#7446d9', sym: '🌙', name: 'הסגול', thing: 'חדר הירח' },
];
export const room = (n) => ROOMS[(n - 1) % ROOMS.length];
export const roomSay = (n) => `החדר ${room(n).name}, ${room(n).thing}`;

export const ANIMALS = [
  { a: '🐻', name: 'דובי', hi: 'שלום! אני דובי. אפשר חדר?' },
  { a: '🐰', name: 'ארנבי', hi: 'היי! אני ארנבי, באתי לחופשה!' },
  { a: '🐧', name: 'פינגי', hi: 'שלום, אני פינגי! קר לי, אפשר חדר חם?' },
  { a: '🦁', name: 'אריק', hi: 'רוארר! אני אריק. אפשר חדר?' },
  { a: '🐘', name: 'פילפיל', hi: 'שלום! אני פילפיל. אפשר חדר גדול?' },
  { a: '🦒', name: "ג'ירפי", hi: "שלום מלמעלה! אני ג'ירפי!" },
  { a: '🐸', name: 'קפצון', hi: 'קווא קווא! אני קפצון. אפשר חדר?' },
  { a: '🦄', name: 'קשתית', hi: 'שלום! אני קשתית, באתי לנוח!' },
  { a: '🐼', name: 'פנדי', hi: 'שלום! אני פנדי. אפשר חדר?' },
  { a: '🐨', name: 'קואלי', hi: 'שלום... אני קואלי. אפשר לישון פה?' },
  { a: '🐷', name: 'חזרזירון', hi: 'אוינק! אני חזרזירון. אפשר חדר?' },
  { a: '🦊', name: 'שועלי', hi: 'שלום! אני שועלי. אפשר חדר?' },
  { a: '🐶', name: 'הבהב', hi: 'הב הב! אני הבהב. אפשר חדר?' },
  { a: '🐱', name: 'מיצי', hi: 'מיאו! אני מיצי. אפשר חדר?' },
  { a: '🐙', name: 'תמנונית', hi: 'שלום! אני תמנונית. באתי מהים!' },
  { a: '🦔', name: 'קיפי', hi: 'שלום! אני קיפי. אפשר חדר?' },
];
export const animal = (a) => ANIMALS.find(x => x.a === a) || ANIMALS[0];

// hot food is cooked first (pan, oven or pot); cold food goes straight onto the tray
export const FOODS = [
  { id: 'pizza', e: '🍕', name: 'פיצה', cook: 'oven' },
  { id: 'pancake', e: '🥞', name: 'פנקייק', cook: 'pan' },
  { id: 'egg', e: '🍳', name: 'ביצה', cook: 'pan' },
  { id: 'pasta', e: '🍝', name: 'ספגטי', cook: 'pot' },
  { id: 'fries', e: '🍟', name: "צ'יפס", cook: 'pot' },
  { id: 'salad', e: '🥗', name: 'סלט' },
  { id: 'icecream', e: '🍦', name: 'גלידה' },
  { id: 'cake', e: '🍰', name: 'עוגה' },
  { id: 'juice', e: '🧃', name: 'מיץ' },
  { id: 'milk', e: '🥛', name: 'חלב' },
  { id: 'apple', e: '🍎', name: 'תפוח' },
  { id: 'banana', e: '🍌', name: 'בננה' },
  { id: 'croissant', e: '🥐', name: 'קרואסון' },
  { id: 'cookie', e: '🍪', name: 'עוגייה' },
  { id: 'watermelon', e: '🍉', name: 'אבטיח' },
];
export const food = (id) => FOODS.find(f => f.id === id) || FOODS[0];

// cleaning jobs; each one is a little game at the cleaning station
export const JOBS = [
  { id: 'dust', e: '🫧', name: 'לנקות', say: 'לנקות את החדר' },
  { id: 'bed', e: '🛏️', name: 'לסדר מיטה', say: 'לסדר את המיטה' },
  { id: 'towels', e: '🧺', name: 'מגבות', say: 'להביא מגבות נקיות' },
  { id: 'trash', e: '🗑️', name: 'פח', say: 'לרוקן את הפח' },
];
export const job = (id) => JOBS.find(j => j.id === id) || JOBS[0];
export const FULL_CLEAN = ['dust', 'bed', 'towels', 'trash'];

// real-world missions shown after an on-screen job (optional, from the parents' settings)
export const REAL_TASKS = {
  dust: { e: '🧽', say: 'משימה אמיתית! לנגב שולחן אחד בבית', text: 'לנגב שולחן אמיתי' },
  bed: { e: '🛏️', say: 'משימה אמיתית! לסדר כרית אחת על המיטה או על הספה', text: 'לסדר כרית אמיתית' },
  towels: { e: '🧺', say: 'משימה אמיתית! לקפל מגבת אחת', text: 'לקפל מגבת אמיתית' },
  trash: { e: '🧸', say: 'משימה אמיתית! להחזיר שלושה צעצועים למקום', text: 'להחזיר 3 צעצועים למקום' },
  food: { e: '🍽️', say: 'משימה אמיתית! לשים על מגש צלחת עם אוכל צעצוע, ולהביא לחדר', text: 'להביא מגש אמיתי לחדר' },
  key: { e: '🔑', say: 'לתת לאורח כרטיס מפתח', text: 'לתת כרטיס מפתח אמיתי' },
};

// the hotel grows as the team collects stars
export const PRIZES = [
  { at: 5, id: 'flowers', e: '🌷', say: 'יש! המלון קיבל גינת פרחים!' },
  { at: 12, id: 'fountain', e: '⛲', say: 'יש! המלון קיבל מזרקה!' },
  { at: 20, id: 'pool', e: '🏊', say: 'יש! המלון קיבל בריכה!' },
  { at: 30, id: 'balloons', e: '🎈', say: 'יש! בלונים צבעוניים למלון!' },
  { at: 42, id: 'slide', e: '🛝', say: 'יש! מגלשה לבריכה!' },
  { at: 56, id: 'rainbow', e: '🌈', say: 'יש! קשת בענן מעל המלון!' },
  { at: 72, id: 'fireworks', e: '🎆', say: 'יש! זיקוקים למלון!' },
  { at: 90, id: 'crown', e: '👑', say: 'מדהים! מלון חמישה כוכבים! כתר זהב למלון!' },
];
export const prizesFor = (stars) => PRIZES.filter(p => stars >= p.at).map(p => p.id);
export const nextPrize = (stars) => PRIZES.find(p => stars < p.at) || null;

export const STATIONS = [
  { id: 'desk', e: '🛎️', name: 'קבלה', say: 'קבלה! כאן מקבלים את האורחים ונותנים להם מפתח', bg: '#ffd166' },
  { id: 'guest', e: '🧳', name: 'אורחים', say: 'אורחים במלון! בוחרים חיה, מקבלים חדר ומזמינים שירות', bg: '#ff9ecb' },
  { id: 'kitchen', e: '🧑‍🍳', name: 'מטבח', say: 'המטבח! כאן מכינים אוכל לאורחים', bg: '#ffab76' },
  { id: 'house', e: '🧹', name: 'ניקיון', say: 'ניקיון! כאן מנקים ומסדרים את החדרים', bg: '#7fd6c2' },
  { id: 'tv', e: '📺', name: 'מסך המלון', say: 'מסך המלון! רואים את כל המלון בגדול', bg: '#a8b8ff' },
];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rid = (n = 8) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
