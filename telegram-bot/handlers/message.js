/**
 * Message Handler
 * Routes incoming Telegram messages to the appropriate agent.
 *
 * Commands:
 *   /director [message] → Director Agent (default for plain messages)
 *   /designer [message] → Designer Agent directly
 *   /developer [message] → Developer Agent directly
 *   /artist [message]   → Artist Agent directly
 *   /qa [message]       → QA Agent directly
 *   /help               → Show available commands
 *   /status             → Show current project status
 *
 * Plain message (no command) → Director Agent
 */

import { runAgent } from '../services/claude.js';
import { loadStudioContext } from '../services/context.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname;

// Map command names to agent names
const COMMAND_TO_AGENT = {
  director: 'director',
  designer: 'designer',
  developer: 'developer',
  artist: 'artist',
  qa: 'qa',
};

const HELP_TEXT = `🎮 *AI Game Studio Bot*

*פקודות זמינות:*
/director [רעיון] — שלח רעיון למשחק חדש (ברירת מחדל)
/designer [הודעה] — שוחח ישירות עם מעצב המשחק
/developer [הודעה] — שוחח ישירות עם המתכנת
/artist [הודעה] — שוחח ישירות עם האמן
/qa [הודעה] — שלח קוד לבדיקה
/status — מה עובדים עליו עכשיו?
/help — הצג עזרה זו

*הודעה רגילה* (ללא פקודה) → מועברת ל-Director`;

/**
 * Handle incoming Telegram message.
 * @param {Object} bot - node-telegram-bot-api instance
 * @param {Object} msg - Telegram message object
 */
export async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) return;

  // /help
  if (text === '/help' || text === '/start') {
    await bot.sendMessage(chatId, HELP_TEXT, { parse_mode: 'Markdown' });
    return;
  }

  // /status
  if (text === '/status') {
    await handleStatus(bot, chatId);
    return;
  }

  // Check for agent commands: /director, /designer, etc.
  const commandMatch = text.match(/^\/(\w+)(?:\s+(.+))?$/s);
  if (commandMatch) {
    const [, command, messageContent] = commandMatch;
    const agentName = COMMAND_TO_AGENT[command];

    if (agentName) {
      if (!messageContent?.trim()) {
        await bot.sendMessage(chatId, `❓ מה אתה רוצה לשאול את ה-${command}?`);
        return;
      }
      await routeToAgent(bot, chatId, agentName, messageContent.trim());
      return;
    }
    // Unknown command — fall through to director
  }

  // Plain message or unknown command → Director Agent
  await routeToAgent(bot, chatId, 'director', text);
}

/**
 * Route a message to a specific agent and send the response back.
 */
async function routeToAgent(bot, chatId, agentName, message) {
  const agentEmoji = {
    director: '🎬',
    designer: '🎨',
    developer: '💻',
    artist: '🖼️',
    qa: '🔍',
  };
  const emoji = agentEmoji[agentName] || '🤖';

  // Send "thinking" indicator
  const thinkingMsg = await bot.sendMessage(
    chatId,
    `${emoji} *${agentName}* חושב...`,
    { parse_mode: 'Markdown' }
  );

  try {
    const response = await runAgent(agentName, message);

    // Delete the "thinking" message
    await bot.deleteMessage(chatId, thinkingMsg.message_id);

    // Send response (split if too long for Telegram's 4096 char limit)
    const chunks = splitMessage(response, 4000);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    await bot.editMessageText(
      `⚠️ שגיאה ב-${agentName}:\n\`${err.message}\``,
      { chat_id: chatId, message_id: thinkingMsg.message_id, parse_mode: 'Markdown' }
    );
    console.error(`[${agentName}] Error:`, err);
  }
}

/**
 * Handle /status command — show current.md content.
 */
async function handleStatus(bot, chatId) {
  try {
    const currentPath = join(REPO_ROOT, 'agents/context/current.md');
    const content = await readFile(currentPath, 'utf8');
    await bot.sendMessage(chatId, `📊 *סטטוס נוכחי:*\n\n${content}`, {
      parse_mode: 'Markdown',
    });
  } catch {
    await bot.sendMessage(chatId, '📊 אין פרויקט פעיל כרגע.');
  }
}

/**
 * Split a long message into chunks for Telegram.
 */
function splitMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLength));
    i += maxLength;
  }
  return chunks;
}
