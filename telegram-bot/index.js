/**
 * AI Game Studio — Telegram Bot Server
 *
 * Receives messages from Liran on Telegram and routes them to AI agents.
 *
 * Setup:
 *   1. Copy .env.example to .env and fill in your keys
 *   2. npm install
 *   3. node index.js
 *
 * For production (public webhook):
 *   Use ngrok or deploy to a server with HTTPS.
 *   Set WEBHOOK_URL in .env and the bot will use webhooks instead of polling.
 */

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { handleMessage } from './handlers/message.js';
import { handleCallback } from './handlers/callbacks.js';

const { TELEGRAM_BOT_TOKEN, WEBHOOK_URL, PORT = 3000, ALLOWED_CHAT_ID } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required in .env');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is required in .env');
  process.exit(1);
}

let bot;

if (WEBHOOK_URL) {
  // Production: use webhook
  const app = express();
  app.use(express.json());

  bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
  bot.setWebHook(`${WEBHOOK_URL}/bot${TELEGRAM_BOT_TOKEN}`);

  app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.listen(PORT, () => {
    console.log(`🚀 Bot running with webhook on port ${PORT}`);
    console.log(`🔗 Webhook: ${WEBHOOK_URL}/bot${TELEGRAM_BOT_TOKEN}`);
  });
} else {
  // Development: use long polling
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('🚀 Bot running with polling (development mode)');
  console.log('💡 Tip: Set WEBHOOK_URL in .env for production mode');
}

// Security: only respond to the configured chat
function isAllowed(msg) {
  if (!ALLOWED_CHAT_ID) return true; // No restriction configured
  return String(msg.chat.id) === String(ALLOWED_CHAT_ID);
}

// Route messages
bot.on('message', async (msg) => {
  if (!isAllowed(msg)) {
    console.log(`Ignored message from unauthorized chat: ${msg.chat.id}`);
    return;
  }
  try {
    await handleMessage(bot, msg);
  } catch (err) {
    console.error('Unhandled error in message handler:', err);
    await bot.sendMessage(msg.chat.id, '⚠️ שגיאה לא צפויה. נסה שוב.');
  }
});

// Route inline keyboard callbacks
bot.on('callback_query', async (query) => {
  if (!isAllowed(query.message)) return;
  try {
    await handleCallback(bot, query);
  } catch (err) {
    console.error('Unhandled error in callback handler:', err);
  }
});

// Polling error handler
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('✅ AI Game Studio Bot initialized');
console.log('📋 Available commands: /director /designer /developer /artist /qa /status /help');
