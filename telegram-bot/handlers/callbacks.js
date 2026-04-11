/**
 * Callback Query Handler
 * Handles inline keyboard button presses from Telegram.
 */

import { runAgent } from '../services/claude.js';

/**
 * Handle inline keyboard button callbacks.
 * @param {Object} bot - node-telegram-bot-api instance
 * @param {Object} query - Telegram callback query object
 */
export async function handleCallback(bot, query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Acknowledge the callback to remove the loading spinner
  await bot.answerCallbackQuery(query.id);

  if (data.startsWith('retry_game:')) {
    const gameName = data.replace('retry_game:', '');
    await bot.sendMessage(chatId, `🔄 מנסה שוב לבנות את *${gameName}*...`, {
      parse_mode: 'Markdown',
    });
    const response = await runAgent('director', `בנה מחדש את המשחק: ${gameName}`);
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    return;
  }

  if (data.startsWith('qa_game:')) {
    const gameName = data.replace('qa_game:', '');
    await bot.sendMessage(chatId, `🔍 מריץ QA על *${gameName}*...`, {
      parse_mode: 'Markdown',
    });
    const response = await runAgent('qa', `בדוק את המשחק: ${gameName}`);
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    return;
  }
}
