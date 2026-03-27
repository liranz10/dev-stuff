import 'dotenv/config';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { ProductAgent } from './agent';

// Conversation history per chat (max 6 messages = 3 turns)
const MAX_HISTORY = 6;
// Clear history after 30 minutes of inactivity
const HISTORY_TTL_MS = 30 * 60 * 1000;

interface ChatSession {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivity: number;
}

const sessions = new Map<string, ChatSession>();
// Prevent concurrent requests from same chat
const processingChats = new Set<string>();

const agent = new ProductAgent();
const allowedNumbers = process.env.ALLOWED_NUMBERS
  ? process.env.ALLOWED_NUMBERS.split(',').map((n) => n.trim())
  : [];
const groupTrigger = process.env.GROUP_TRIGGER || '';

function getSession(chatId: string): ChatSession {
  const session = sessions.get(chatId);
  if (session) {
    // Expire old sessions
    if (Date.now() - session.lastActivity > HISTORY_TTL_MS) {
      sessions.delete(chatId);
    } else {
      return session;
    }
  }
  const newSession: ChatSession = { history: [], lastActivity: Date.now() };
  sessions.set(chatId, newSession);
  return newSession;
}

function updateSession(chatId: string, userMsg: string, assistantMsg: string): void {
  const session = getSession(chatId);
  session.history.push({ role: 'user', content: userMsg });
  session.history.push({ role: 'assistant', content: assistantMsg });
  // Keep only last MAX_HISTORY messages
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
  session.lastActivity = Date.now();
}

async function handleMessage(msg: Message, client: Client): Promise<void> {
  const chatId = msg.from;

  // Skip own messages and status broadcasts
  if (msg.fromMe || msg.from === 'status@broadcast') return;

  const chat = await msg.getChat();
  const body = msg.body.trim();

  // In groups: only respond to trigger keyword or mentions
  if (chat.isGroup) {
    const isMentioned = msg.mentionedIds.some(
      (id) => id._serialized === client.info.wid._serialized
    );
    const hasTrigger = groupTrigger && body.startsWith(groupTrigger);
    if (!isMentioned && !hasTrigger) return;
  }

  // Check allowed numbers (if configured)
  if (allowedNumbers.length > 0) {
    const senderNumber = msg.from.replace('@c.us', '');
    if (!allowedNumbers.includes(senderNumber)) return;
  }

  // Prevent concurrent requests from same chat
  if (processingChats.has(chatId)) {
    await msg.reply('⏳ עוד מעט... מסיים את החיפוש הקודם');
    return;
  }

  // Strip trigger prefix from body if present
  const query = groupTrigger ? body.replace(groupTrigger, '').trim() : body;
  if (!query) return;

  processingChats.add(chatId);

  try {
    // Send typing indicator and acknowledgment
    await chat.sendStateTyping();
    await msg.reply('🔍 מחפש לך... רגע אחד!');

    const session = getSession(chatId);
    const response = await agent.findProducts(query, session.history);

    updateSession(chatId, query, response);
    await chat.clearState();
    await msg.reply(response);
  } catch (err) {
    console.error(`Error processing message from ${chatId}:`, err);
    await chat.clearState();
    await msg.reply('😕 קרתה תקלה בחיפוש. נסה שוב בעוד כמה שניות.');
  } finally {
    processingChats.delete(chatId);
  }
}

const whatsappClient = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

whatsappClient.on('qr', (qr) => {
  console.log('\n📱 סרוק את הקוד הבא עם הוואטסאפ שלך (WhatsApp > שלוש נקודות > מכשירים מקושרים):\n');
  qrcode.generate(qr, { small: true });
});

whatsappClient.on('authenticated', () => {
  console.log('✅ הוואטסאפ אומת בהצלחה');
});

whatsappClient.on('ready', () => {
  const info = whatsappClient.info;
  console.log(`\n🤖 הבוט מוכן! מחובר כ: ${info.pushname} (${info.wid.user})`);
  console.log('🛒 מחפש מוצרים מכל הרשתות החברתיות...');
  if (allowedNumbers.length > 0) {
    console.log(`🔒 מוגבל למספרים: ${allowedNumbers.join(', ')}`);
  }
  if (groupTrigger) {
    console.log(`👥 טריגר לקבוצות: "${groupTrigger}"`);
  }
});

whatsappClient.on('message', (msg) => {
  handleMessage(msg, whatsappClient).catch((err) => {
    console.error('Unhandled error in message handler:', err);
  });
});

whatsappClient.on('disconnected', (reason) => {
  console.warn('⚠️ הבוט התנתק:', reason);
  console.log('מנסה להתחבר מחדש...');
  whatsappClient.initialize().catch(console.error);
});

console.log('🚀 מאתחל את בוט הוואטסאפ...');
whatsappClient.initialize().catch((err) => {
  console.error('Failed to initialize WhatsApp client:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 מנתק את הבוט...');
  await whatsappClient.destroy();
  process.exit(0);
});
