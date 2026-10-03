// Everything the flight is made of: the family, the seats and the places we can fly to.

// airports (lat/lon of the real airport); `hello` is how people say hello there
export const PLACES = [
  { id: 'tlv', city: 'תל אביב', land: 'ישראל', f: '🇮🇱', lat: 32.01, lon: 34.89, e: '🏖️', hello: 'שלום', fact: 'הגענו הביתה! איזה כיף לחזור הביתה' },
  { id: 'paris', city: 'פריז', land: 'צרפת', f: '🇫🇷', lat: 49.01, lon: 2.55, e: '🗼', hello: 'בונז\'ור', fact: 'בפריז יש מגדל ענק מברזל, מגדל אייפל' },
  { id: 'london', city: 'לונדון', land: 'בריטניה', f: '🇬🇧', lat: 51.47, lon: -0.45, e: '💂', hello: 'הלו', fact: 'בלונדון יש אוטובוסים אדומים עם שתי קומות' },
  { id: 'rome', city: 'רומא', land: 'איטליה', f: '🇮🇹', lat: 41.80, lon: 12.25, e: '🍕', hello: 'צ\'או', fact: 'באיטליה המציאו את הפיצה' },
  { id: 'eilat', city: 'אילת', land: 'ישראל', f: '🇮🇱', lat: 29.72, lon: 35.01, e: '🐠', hello: 'שלום', fact: 'באילת יש ים עם דגים צבעוניים' },
  { id: 'nairobi', city: 'קניה', land: 'קניה', f: '🇰🇪', lat: -1.32, lon: 36.93, e: '🦒', hello: 'ג\'מבו', fact: 'בקניה יש ג\'ירפות, זברות ופילים' },
  { id: 'bangkok', city: 'תאילנד', land: 'תאילנד', f: '🇹🇭', lat: 13.69, lon: 100.75, e: '🐘', hello: 'סוואדי קה', fact: 'בתאילנד יש פילים ומקדשים של זהב' },
  { id: 'tokyo', city: 'טוקיו', land: 'יפן', f: '🇯🇵', lat: 35.55, lon: 139.78, e: '🗻', hello: 'קוניצ\'יווה', fact: 'ביפן יש רכבת מהירה מאוד והר עם שלג' },
  { id: 'newyork', city: 'ניו יורק', land: 'אמריקה', f: '🇺🇸', lat: 40.64, lon: -73.78, e: '🗽', hello: 'הלו', fact: 'בניו יורק יש בניינים גבוהים מאוד' },
];
export const place = (id) => PLACES.find(p => p.id === id) || PLACES[0];
export const HOME = 'tlv';

// the real people at home; each one gets a seat with a colour and a symbol (printable signs in print.html)
export const PEOPLE = [
  { e: '👩', name: 'אמא' },
  { e: '👨', name: 'אבא' },
  { e: '👧', name: 'יובל' },
  { e: '👧🏼', name: 'עלמה' },
  { e: '👵', name: 'סבתא' },
  { e: '👴', name: 'סבא' },
];

export const SEATS = [
  { n: 1, color: '#ff7eb6', dark: '#d94a8c', light: '#ffe0ef', sym: '🌸', thing: 'הכיסא הוורוד עם הפרח' },
  { n: 2, color: '#ffc93c', dark: '#d99a00', light: '#fff4cc', sym: '☀️', thing: 'הכיסא הצהוב עם השמש' },
  { n: 3, color: '#4fb8ff', dark: '#1f86d1', light: '#dcf1ff', sym: '🐟', thing: 'הכיסא הכחול עם הדג' },
  { n: 4, color: '#5fd068', dark: '#2f9e3a', light: '#e0f8e2', sym: '🌳', thing: 'הכיסא הירוק עם העץ' },
  { n: 5, color: '#ff6b5e', dark: '#d63a2e', light: '#ffe2df', sym: '❤️', thing: 'הכיסא האדום עם הלב' },
  { n: 6, color: '#a77bff', dark: '#7446d9', light: '#eee5ff', sym: '🌙', thing: 'הכיסא הסגול עם הירח' },
];
