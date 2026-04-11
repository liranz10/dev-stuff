/**
 * Claude SDK wrapper
 * Sends a message to a specific agent and streams the response.
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadStudioContext, loadAgentInstructions } from './context.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-6';

/**
 * Run an agent and return its full response as a string.
 * @param {'director'|'designer'|'developer'|'artist'|'qa'} agentName
 * @param {string} userMessage - The message to send to the agent
 * @param {string} [extraContext] - Optional extra context (e.g. GDD content)
 * @returns {Promise<string>} The agent's response
 */
export async function runAgent(agentName, userMessage, extraContext = '') {
  const [agentInstructions, studioContext] = await Promise.all([
    loadAgentInstructions(agentName),
    loadStudioContext(),
  ]);

  const systemPrompt = `${agentInstructions}\n\n## Studio Context (ABC-TOM)\n${studioContext}${extraContext ? `\n\n## Additional Context\n${extraContext}` : ''}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  return response.content[0].text;
}

/**
 * Run an agent and stream the response, calling onChunk for each text chunk.
 * @param {'director'|'designer'|'developer'|'artist'|'qa'} agentName
 * @param {string} userMessage
 * @param {function(string): void} onChunk - Called with each streamed text chunk
 * @param {string} [extraContext]
 * @returns {Promise<string>} Full response text
 */
export async function runAgentStreaming(agentName, userMessage, onChunk, extraContext = '') {
  const [agentInstructions, studioContext] = await Promise.all([
    loadAgentInstructions(agentName),
    loadStudioContext(),
  ]);

  const systemPrompt = `${agentInstructions}\n\n## Studio Context (ABC-TOM)\n${studioContext}${extraContext ? `\n\n## Additional Context\n${extraContext}` : ''}`;

  let fullText = '';

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 8096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullText += chunk.delta.text;
      onChunk(chunk.delta.text);
    }
  }

  return fullText;
}
