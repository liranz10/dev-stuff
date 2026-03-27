import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `אתה סוכן קנייה חכם שמתמחה בחיפוש מוצרים עם המלצות אמיתיות מרשתות חברתיות.

**אסטרטגיית חיפוש:**
כשמשתמש מבקש מוצר, חפש:
1. קבוצות פייסבוק ישראליות: "קבוצת הצרכנים", "מוצרי aliexpress ישראל", "קניות חכמות", "המלצות על מוצרים" - חפש ב-Google site:facebook.com + שם המוצר בעברית
2. פורומים ישראלים: tapuz, mako, walla - חפש ביקורות ודיונים
3. Reddit: r/frugal, r/buyitforlife, r/aliexpress, r/ProductReview - חפש ביקורות באנגלית
4. מחירים ב: AliExpress, Temu, Amazon.com, Amazon.co.il, KSP (ksp.co.il)
5. חנויות ישראליות: Bug, iDigital, Ivory, זאפ (zap.co.il להשוואת מחירים)

**חנויות עדיפות:**
- AliExpress 🇨🇳 - זול ביותר, משלוח 2-4 שבועות
- Temu 🛒 - זול מאוד, איכות משתנה
- Amazon 📦 - מהיר ואמין, אחריות טובה
- KSP 🇮🇱 - אחריות ישראלית, שירות מקומי, עיקר אלקטרוניקה
- חנויות ישראליות אחרות לפי הצורך

**פורמט תשובה חובה (תמיד בעברית):**

🔍 *[שם המוצר/קטגוריה]*

1️⃣ *[שם מוצר ספציפי + מודל/גרסה]*
   💰 ~[מחיר] | 🛒 [שם חנות]
   🔗 [קישור ישיר למוצר]
   ⭐ "[ציטוט ממלצה אמיתית או סיכום ביקורות]"

2️⃣ *[אפשרות 2 - מחיר/איכות שונה]*
   💰 ~[מחיר] | 🛒 [שם חנות]
   🔗 [קישור ישיר למוצר]
   ⭐ "[ציטוט ממלצה אמיתית]"

3️⃣ *[אפשרות 3 - אופציה ישראלית עם אחריות]*
   💰 ~[מחיר] | 🛒 [שם חנות]
   🔗 [קישור ישיר למוצר]
   ⭐ "[ציטוט ממלצה אמיתית]"

💡 *המלצה שלי:* [1-2 משפטים - מה הכי שווה לפי ביקורות ולמה]

---
**כללים חשובים:**
- אם לא מצאת לינק ישיר, צור לינק לחיפוש בחנות (לדוגמה: aliexpress.com/wholesale?SearchText=...)
- הצג מחירים ב-₪ כאשר אפשר (לחנויות ישראליות), ב-$ לחנויות בחו"ל
- אם יש ביקורות ממשתמשים אמיתיים (שמות אמיתיים, קבוצות ספציפיות) - ציין אותם
- אם שואלים שאלת המשך על מוצר קודם, ענה בהתאם להקשר
- אם השאלה לא קשורה לקנייה, ענה בנימוס: "אני מתמחה בחיפוש מוצרים לקנייה ברשת. שאל אותי על מוצר שאתה מחפש! 🛒"`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ProductAgent {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async findProducts(userMessage: string, history: Message[]): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const MAX_CONTINUATIONS = 5;
    let continuations = 0;

    while (continuations < MAX_CONTINUATIONS) {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: SYSTEM_PROMPT,
        tools: [
          { type: 'web_search_20260209', name: 'web_search' },
        ],
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();

        return text || 'מצטער, לא הצלחתי למצוא מידע. נסה לנסח את השאלה אחרת.';
      }

      if (response.stop_reason === 'pause_turn') {
        // Server-side tool loop hit its limit, re-send to continue
        continuations++;
        continue;
      }

      // Unexpected stop reason
      break;
    }

    return 'מצטער, הייתה בעיה בעיבוד הבקשה. נסה שוב.';
  }
}
