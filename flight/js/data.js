// Everything the flight is made of: places, seats, passengers, the service cart and the stations.
// The players are girls, so spoken lines that talk to the player use the feminine form (טייסת, דיילת).

// airports (lat/lon of the real airport); `hello` is how people say hello there
export const PLACES = [
  { id: 'tlv', city: 'תל אביב', land: 'ישראל', f: '🇮🇱', lat: 32.01, lon: 34.89, e: '🏖️', hello: 'שלום', fact: 'בישראל יש ים, מדבר והרבה שמש' },
  { id: 'eilat', city: 'אילת', land: 'ישראל', f: '🇮🇱', lat: 29.72, lon: 35.01, e: '🐠', hello: 'שלום', fact: 'באילת יש ים אדום עם דגים צבעוניים ואלמוגים' },
  { id: 'larnaca', city: 'לרנקה', land: 'קפריסין', f: '🇨🇾', lat: 34.88, lon: 33.63, e: '🏝️', hello: 'יאסו', fact: 'קפריסין היא אי, ארץ שיש מסביב לה ים מכל הצדדים' },
  { id: 'athens', city: 'אתונה', land: 'יוון', f: '🇬🇷', lat: 37.94, lon: 23.94, e: '🏛️', hello: 'יאסו', fact: 'ביוון יש בתים לבנים עם גגות כחולים, ומקדשים עתיקים מאוד' },
  { id: 'rome', city: 'רומא', land: 'איטליה', f: '🇮🇹', lat: 41.80, lon: 12.25, e: '🍕', hello: 'צ\'או', fact: 'באיטליה המציאו את הפיצה! וברומא יש בניין עתיק וענק שקוראים לו קולוסיאום' },
  { id: 'paris', city: 'פריז', land: 'צרפת', f: '🇫🇷', lat: 49.01, lon: 2.55, e: '🗼', hello: 'בונז\'ור', fact: 'בפריז יש את מגדל אייפל, מגדל ענק מברזל. ואוכלים שם קרואסונים' },
  { id: 'barcelona', city: 'ברצלונה', land: 'ספרד', f: '🇪🇸', lat: 41.30, lon: 2.08, e: '⚽', hello: 'הולה', fact: 'בספרד רוקדים פלמנקו, ובברצלונה יש כנסייה מיוחדת שבונים כבר יותר ממאה שנה' },
  { id: 'amsterdam', city: 'אמסטרדם', land: 'הולנד', f: '🇳🇱', lat: 52.31, lon: 4.76, e: '🌷', hello: 'חוי', fact: 'בהולנד יש שדות של צבעונים, טחנות רוח, ונוסעים בכל מקום באופניים' },
  { id: 'london', city: 'לונדון', land: 'בריטניה', f: '🇬🇧', lat: 51.47, lon: -0.45, e: '💂', hello: 'הלו', fact: 'בלונדון יש אוטובוסים אדומים עם שתי קומות, ומלך שגר בארמון' },
  { id: 'dubai', city: 'דובאי', land: 'איחוד האמירויות', f: '🇦🇪', lat: 25.25, lon: 55.36, e: '🐪', hello: 'מרחבא', fact: 'בדובאי יש את הבניין הכי גבוה בעולם, וגמלים במדבר' },
  { id: 'nairobi', city: 'ניירובי', land: 'קניה', f: '🇰🇪', lat: -1.32, lon: 36.93, e: '🦒', hello: 'ג\'מבו', fact: 'בקניה יוצאים לספארי ורואים ג\'ירפות, זברות, פילים ואריות' },
  { id: 'bangkok', city: 'בנגקוק', land: 'תאילנד', f: '🇹🇭', lat: 13.69, lon: 100.75, e: '🐘', hello: 'סוואדי קה', fact: 'בתאילנד יש פילים, מקדשים מוזהבים ושווקים על סירות' },
  { id: 'tokyo', city: 'טוקיו', land: 'יפן', f: '🇯🇵', lat: 35.55, lon: 139.78, e: '🗻', hello: 'קוניצ\'יווה', fact: 'ביפן יש רכבת מהירה מאוד, הר גבוה עם שלג שקוראים לו פוג\'י, ואוכלים סושי' },
  { id: 'newyork', city: 'ניו יורק', land: 'ארצות הברית', f: '🇺🇸', lat: 40.64, lon: -73.78, e: '🗽', hello: 'הלו', fact: 'בניו יורק יש בניינים גבוהים מאוד, ופסל ירוק וענק שקוראים לו פסל החירות' },
];
export const place = (id) => PLACES.find(p => p.id === id) || PLACES[0];
export const HOME = 'tlv';

// seats: each seat has a colour and a symbol, so it can be found without reading
export const SEATS = [
  { n: 1, color: '#ff7eb6', light: '#ffe0ef', dark: '#d94a8c', sym: '🌸', name: 'הוורוד', thing: 'הכיסא הוורוד עם הפרח' },
  { n: 2, color: '#ffc93c', light: '#fff4cc', dark: '#d99a00', sym: '☀️', name: 'הצהוב', thing: 'הכיסא הצהוב עם השמש' },
  { n: 3, color: '#4fb8ff', light: '#dcf1ff', dark: '#1f86d1', sym: '🐟', name: 'הכחול', thing: 'הכיסא הכחול עם הדג' },
  { n: 4, color: '#5fd068', light: '#e0f8e2', dark: '#2f9e3a', sym: '🌳', name: 'הירוק', thing: 'הכיסא הירוק עם העץ' },
  { n: 5, color: '#ff6b5e', light: '#ffe2df', dark: '#d63a2e', sym: '❤️', name: 'האדום', thing: 'הכיסא האדום עם הלב' },
  { n: 6, color: '#a77bff', light: '#eee5ff', dark: '#7446d9', sym: '🌙', name: 'הסגול', thing: 'הכיסא הסגול עם הירח' },
  { n: 7, color: '#ff9f43', light: '#ffeedd', dark: '#d9741a', sym: '🦋', name: 'הכתום', thing: 'הכיסא הכתום עם הפרפר' },
  { n: 8, color: '#2ec4b6', light: '#d9f7f4', dark: '#16968a', sym: '⭐', name: 'הטורקיז', thing: 'הכיסא הטורקיז עם הכוכב' },
];
export const seat = (n) => SEATS[(n - 1) % SEATS.length];

// who can fly: real people at home (and toys!) are added at check-in; animals are pretend passengers
export const PEOPLE = [
  { e: '👩', name: 'אמא' },
  { e: '👨', name: 'אבא' },
  { e: '👧', name: 'יובל' },
  { e: '👧🏼', name: 'עלמה' },
  { e: '👵', name: 'סבתא' },
  { e: '👴', name: 'סבא' },
  { e: '👦', name: 'אח' },
  { e: '👶', name: 'תינוק' },
  { e: '🧸', name: 'דובי', toy: true },
  { e: '🐶', name: 'כלבלב', toy: true },
  { e: '🦄', name: 'חד קרן', toy: true },
  { e: '🪆', name: 'בובה', toy: true },
];
export const ANIMALS = [
  { e: '🐻', name: 'דובי' }, { e: '🐰', name: 'ארנבי' }, { e: '🐧', name: 'פינגי' }, { e: '🦁', name: 'אריק' },
  { e: '🐘', name: 'פילפיל' }, { e: '🦒', name: 'ג\'ירפי' }, { e: '🐸', name: 'קפצון' }, { e: '🐼', name: 'פנדי' },
  { e: '🐨', name: 'קואלי' }, { e: '🐷', name: 'חזרזירון' }, { e: '🦊', name: 'שועלי' }, { e: '🐱', name: 'מיצי' },
  { e: '🐵', name: 'קופיקו' }, { e: '🦔', name: 'קיפי' },
];

// the service cart
export const MENU = [
  { id: 'water', e: '💧', name: 'מים', kind: 'drink' },
  { id: 'juice', e: '🧃', name: 'מיץ', kind: 'drink' },
  { id: 'milk', e: '🥛', name: 'חלב', kind: 'drink' },
  { id: 'tea', e: '☕', name: 'תה', kind: 'drink', hot: true },
  { id: 'pasta', e: '🍝', name: 'פסטה', kind: 'food', hot: true },
  { id: 'sandwich', e: '🥪', name: 'כריך', kind: 'food' },
  { id: 'pretzel', e: '🥨', name: 'בייגלה', kind: 'food' },
  { id: 'apple', e: '🍎', name: 'תפוח', kind: 'food' },
  { id: 'cookie', e: '🍪', name: 'עוגייה', kind: 'food' },
  { id: 'icecream', e: '🍦', name: 'גלידה', kind: 'food' },
  { id: 'blanket', e: '🧣', name: 'שמיכה', kind: 'comfort' },
  { id: 'pillow', e: '🛏️', name: 'כרית', kind: 'comfort' },
  { id: 'headphones', e: '🎧', name: 'אוזניות', kind: 'comfort' },
  { id: 'crayons', e: '🖍️', name: 'צבעים', kind: 'comfort' },
];
export const menuItem = (id) => MENU.find(m => m.id === id) || MENU[0];

// real things to do at home, shown next to the on-screen job (can be turned off by the parents)
export const REAL = {
  bag: { e: '🧳', text: 'מביאים תיק או מזוודה אמיתיים', say: 'משימה אמיתית! מביאים תיק או מזוודה, ושמים על המשקל' },
  pass: { e: '🎫', text: 'נותנים כרטיס עלייה', say: 'נותנים לנוסע את כרטיס העלייה למטוס' },
  seat: { e: '🪑', text: 'מראים את הכיסא האמיתי', say: 'משימה אמיתית! הולכים יחד לכיסא האמיתי ועוזרים לשבת' },
  belt: { e: '🔒', text: 'בודקים שכולם חגורים', say: 'עוברים בין הכיסאות ובודקים שכולם חגורים' },
  serve: { e: '🍽️', text: 'מביאים לכיסא אוכל או שתייה', say: 'משימה אמיתית! מביאים את זה לכיסא. אפשר כוס מים אמיתית או אוכל צעצוע' },
  trays: { e: '🧺', text: 'אוספים את כל הכוסות והמגשים', say: 'עוד מעט נוחתים! אוספים מכל הנוסעים את הכוסות והמגשים' },
  bye: { e: '🙌', text: 'כיף לכל נוסע ביציאה', say: 'עומדים ליד הדלת, אומרים להתראות ונותנים כיף לכל נוסע' },
  clap: { e: '👏', text: 'כולם מוחאים כפיים!', say: 'נחתנו! כולם מוחאים כפיים לטייסת!' },
  bump: { e: '🤸', text: 'קופצים קצת על הכיסא', say: 'מערבולת! כולם חוגרים חגורה וקופצים קצת על הכיסא!' },
};

// the safety show: the flight attendant shows each step and the passengers copy it
export const SAFETY = [
  { e: '🔒', say: 'חגורת בטיחות. מכניסים את הקליפס, קליק! ומהדקים', text: 'סוגרים חגורה. קליק!' },
  { e: '😷', say: 'אם צריך, יורדת מסכה מלמעלה. שמים על האף והפה, ונושמים רגיל', text: 'מסכה על האף והפה' },
  { e: '🦺', say: 'מתחת לכיסא יש אפוד הצלה צהוב. שמים מעל הראש וקושרים', text: 'אפוד הצלה צהוב' },
  { e: '🚪', say: 'יש דלתות יציאה מקדימה, באמצע ומאחורה. מראים עם הידיים לאן', text: 'הדלתות: קדימה ואחורה' },
  { e: '📵', say: 'בהמראה ובנחיתה יושבים, חגורים, ומקשיבים לדיילת', text: 'יושבים ומקשיבים' },
];

export const STATIONS = [
  { id: 'checkin', e: '🎫', name: 'צ\'ק-אין', say: 'צ\'ק אין! כאן מקבלים את הנוסעים, שוקלים מזוודות ונותנים כרטיס עלייה', bg: '#ffd166' },
  { id: 'crew', e: '💁‍♀️', name: 'דיילת', say: 'דיילת! מראים לנוסעים את המקום שלהם, ונותנים להם אוכל ושתייה בטיסה', bg: '#ff9ecb' },
  { id: 'pilot', e: '👩‍✈️', name: 'טייסת', say: 'טייסת! בוחרים לאן טסים, ממריאים, טסים ונוחתים', bg: '#8fd3ff' },
  { id: 'pax', e: '💺', name: 'נוסעים', say: 'נוסעים! יושבים בכיסא, מסתכלים מהחלון ומזמינים מהדיילת', bg: '#b4e88f' },
  { id: 'tv', e: '🗺️', name: 'מסך המפה', say: 'מסך המפה! רואים בגדול איפה המטוס עכשיו', bg: '#c3b5ff' },
];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rid = (n = 8) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
