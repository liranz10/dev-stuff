#!/usr/bin/env node
/**
 * fix-git-bash-detection.js
 *
 * Detects Git Bash on Windows and updates Claude Code's settings
 * to use it as the shell, fixing "cannot find Git Bash" errors.
 *
 * Usage:
 *   node fix-git-bash-detection.js          # detect and auto-update settings
 *   node fix-git-bash-detection.js --dry-run # detect only, print result
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const DRY_RUN = process.argv.includes("--dry-run");

// ── 1. Candidate paths to probe ──────────────────────────────────────────────

function candidatePaths() {
  const candidates = [];

  // Standard installer locations
  const programFiles = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    process.env["ProgramW6432"],
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ].filter(Boolean);

  for (const pf of programFiles) {
    candidates.push(path.join(pf, "Git", "bin", "bash.exe"));
    candidates.push(path.join(pf, "Git", "usr", "bin", "bash.exe"));
  }

  // Per-user installation (winget / GitHub Desktop bundled Git)
  const localAppData = process.env["LOCALAPPDATA"];
  if (localAppData) {
    candidates.push(
      path.join(localAppData, "Programs", "Git", "bin", "bash.exe")
    );
    candidates.push(
      path.join(localAppData, "Programs", "Git", "usr", "bin", "bash.exe")
    );
  }

  // Scoop
  const userProfile = process.env["USERPROFILE"] || os.homedir();
  candidates.push(
    path.join(userProfile, "scoop", "apps", "git", "current", "bin", "bash.exe")
  );
  candidates.push(
    path.join(userProfile, "scoop", "apps", "git", "current", "usr", "bin", "bash.exe")
  );

  // Chocolatey
  candidates.push("C:\\tools\\git\\bin\\bash.exe");
  candidates.push("C:\\tools\\git\\usr\\bin\\bash.exe");

  return [...new Set(candidates)]; // deduplicate
}

// ── 2. Registry-based detection ───────────────────────────────────────────────

function detectViaRegistry() {
  const keys = [
    "HKLM\\SOFTWARE\\GitForWindows",
    "HKLM\\SOFTWARE\\WOW6432Node\\GitForWindows",
    "HKCU\\SOFTWARE\\GitForWindows",
  ];

  for (const key of keys) {
    try {
      const output = execSync(`reg query "${key}" /v InstallPath`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/i);
      if (match) {
        const installPath = match[1].trim();
        const bash = path.join(installPath, "bin", "bash.exe");
        if (fs.existsSync(bash)) return bash;
        const bash2 = path.join(installPath, "usr", "bin", "bash.exe");
        if (fs.existsSync(bash2)) return bash2;
      }
    } catch {
      // key not present — try next
    }
  }
  return null;
}

// ── 3. Derive from `git` on PATH ──────────────────────────────────────────────

function detectViaGitOnPath() {
  try {
    const gitPath = execSync("where git", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .split(/\r?\n/)[0]
      .trim();

    if (!gitPath) return null;

    // git.exe is typically at <root>\cmd\git.exe or <root>\bin\git.exe
    const root = path.resolve(gitPath, "..", "..");
    const candidates = [
      path.join(root, "bin", "bash.exe"),
      path.join(root, "usr", "bin", "bash.exe"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } catch {
    // `where` not available or git not on PATH
  }
  return null;
}

// ── 4. Run all detection strategies ──────────────────────────────────────────

function detectGitBash() {
  // Strategy A: registry (most reliable on Windows)
  const fromRegistry = detectViaRegistry();
  if (fromRegistry) return { path: fromRegistry, source: "registry" };

  // Strategy B: well-known paths
  for (const p of candidatePaths()) {
    if (fs.existsSync(p)) return { path: p, source: "known-path" };
  }

  // Strategy C: derive from git on PATH
  const fromPath = detectViaGitOnPath();
  if (fromPath) return { path: fromPath, source: "git-on-path" };

  return null;
}

// ── 5. Update Claude Code settings ───────────────────────────────────────────

function claudeSettingsPath() {
  const home = os.homedir();
  // Claude Code stores settings in ~/.claude/settings.json
  return path.join(home, ".claude", "settings.json");
}

function updateClaudeSettings(bashPath) {
  const settingsFile = claudeSettingsPath();
  let settings = {};

  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    } catch (e) {
      console.error(`Warning: could not parse ${settingsFile}: ${e.message}`);
      console.error("Creating a fresh settings file.");
    }
  } else {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  }

  // Use forward slashes — Claude Code / Node prefer them even on Windows
  const normalised = bashPath.replace(/\\/g, "/");

  if (settings.shell === normalised) {
    console.log("Claude Code settings already point to the detected Git Bash.");
    return false;
  }

  const previous = settings.shell;
  settings.shell = normalised;

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n", "utf8");

  if (previous) {
    console.log(`Updated shell: ${previous} → ${normalised}`);
  } else {
    console.log(`Set shell: ${normalised}`);
  }
  console.log(`Written to: ${settingsFile}`);
  return true;
}

// ── 6. Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("Searching for Git Bash...\n");

  const result = detectGitBash();

  if (!result) {
    console.error(
      "Git Bash not found.\n\n" +
      "Make sure Git for Windows is installed:\n" +
      "  https://git-scm.com/download/win\n\n" +
      "If Git Bash is installed in a custom location, set the path manually:\n" +
      '  Add \\"shell\\": \\"C:/path/to/bash.exe\\" to ~/.claude/settings.json'
    );
    process.exit(1);
  }

  console.log(`Found Git Bash (via ${result.source}):`);
  console.log(`  ${result.path}\n`);

  if (DRY_RUN) {
    console.log("Dry-run mode — Claude Code settings were NOT modified.");
    console.log(
      `To apply, run without --dry-run, or add this to ~/.claude/settings.json:\n` +
      `  "shell": "${result.path.replace(/\\/g, "/")}"`
    );
    return;
  }

  updateClaudeSettings(result.path);
  console.log(
    "\nDone. Restart Claude Code for the change to take effect."
  );
}

main();
