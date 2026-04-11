/**
 * ABC-TOM Context Loader
 * Reads the agents/ memory files and returns a combined context string
 * for injecting into agent prompts.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

const REPO_ROOT = new URL('../../', import.meta.url).pathname;

const ABC_TOM_FILES = [
  'agents/about/owner.md',
  'agents/business/studio.md',
  'agents/context/current.md',
  'agents/tools/stack.md',
  'agents/outputs/format.md',
  'agents/memory/decisions.md',
];

/**
 * Load all ABC-TOM context files and return as a single string.
 */
export async function loadStudioContext() {
  const parts = [];
  for (const relPath of ABC_TOM_FILES) {
    const fullPath = join(REPO_ROOT, relPath);
    try {
      const content = await readFile(fullPath, 'utf8');
      parts.push(`\n\n--- ${relPath} ---\n${content}`);
    } catch {
      // File missing — skip silently
    }
  }
  return parts.join('');
}

/**
 * Load a specific agent's CLAUDE.md instructions.
 * @param {'director'|'designer'|'developer'|'artist'|'qa'} agentName
 */
export async function loadAgentInstructions(agentName) {
  const path = join(REPO_ROOT, `agents-config/${agentName}/CLAUDE.md`);
  try {
    return await readFile(path, 'utf8');
  } catch {
    return `# ${agentName} Agent\nNo instructions file found.`;
  }
}

/**
 * Update the current context file with the active game project.
 * @param {string} gameName
 * @param {string} phase
 */
export async function updateCurrentContext(gameName, phase) {
  const path = join(REPO_ROOT, 'agents/context/current.md');
  const content = `# Current Context\n\n## Active Project\n**Name**: ${gameName}\n**Phase**: ${phase}\n\n## Last Updated\n${new Date().toISOString().split('T')[0]}\n`;
  const { writeFile } = await import('fs/promises');
  await writeFile(path, content, 'utf8');
}
