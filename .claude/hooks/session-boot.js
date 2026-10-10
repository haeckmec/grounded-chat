#!/usr/bin/env node
// SessionStart hook: prints a short boot block that Claude Code injects as context.
// Reports mode, recent commits, open gaps, pending fast-forward decisions, mode triggers
// and hook commands that point at missing files. Silent outside git repos.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repo = process.cwd();
const rel = (p) => path.join(repo, p);
const read = (p) => (fs.existsSync(rel(p)) ? fs.readFileSync(rel(p), 'utf8') : null);
function sh(cmd) {
  try {
    return execSync(cmd, { cwd: repo, timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    return null;
  }
}

if (sh('git rev-parse --is-inside-work-tree') !== 'true') process.exit(0);

const out = [];
const claude = read('CLAUDE.md') || '';
const modeMatch = claude.match(/^Mode:\s*(light|full)/m);
const mode = modeMatch ? modeMatch[1] : 'unknown';
out.push(`Mode: ${mode}. Methodology: _reference/methodology.md`);

const log = sh('git log -5 --pretty=format:"%h %s"');
if (log) out.push('Recent commits:\n' + log.split('\n').map((l) => '  ' + l).join('\n'));

// Open gaps are table rows above the "## Closed" heading whose status column says Open or Waiting.
const gaps = read('_reference/gaps.md');
if (gaps) {
  const openPart = gaps.split(/^## Closed/m)[0];
  const rows = openPart.split('\n').filter((l) => /^\|\s*G-\d+/.test(l));
  const open = rows.filter((l) => /\|\s*(Open|Waiting)\s*\|/.test(l));
  out.push(`Open gaps: ${open.length} of ${rows.length} listed. Search _reference/gaps.md before filing a bug.`);
}

const decisions = read('_reference/decisions.md');
if (decisions) {
  const pending = decisions.split('\n').filter((l) => /^\|\s*D-\d+/.test(l) && /Overridable/i.test(l));
  if (pending.length) out.push(`Fast-forward decisions awaiting Jan's review: ${pending.length} (see _reference/decisions.md).`);
}

if (mode === 'full') {
  const exec = read('_reference/execution-prompt.md');
  const m = exec && exec.match(/<resume_status>([\s\S]*?)<\/resume_status>/);
  if (m) out.push('Resume status:' + m[1].replace(/\n+$/, ''));
}

// Light-mode triggers that can be read from the file tree.
if (mode === 'light') {
  const triggers = [];
  const apps = fs.existsSync(rel('apps')) ? fs.readdirSync(rel('apps')).filter((d) => fs.statSync(rel(path.join('apps', d))).isDirectory()) : [];
  if (apps.length > 1) triggers.push(`${apps.length} apps (${apps.join(', ')})`);
  const firstCommit = sh('git log --reverse --pretty=format:%ct');
  const ageDays = firstCommit ? (Date.now() / 1000 - Number(firstCommit.split('\n')[0])) / 86400 : 0;
  const openGaps = gaps ? gaps.split(/^## Closed/m)[0].split('\n').filter((l) => /^\|\s*G-\d+.*\|\s*Open\s*\|/.test(l)).length : 0;
  if (ageDays > 28 && openGaps > 15) triggers.push(`${Math.round(ageDays)} days old with ${openGaps} open gaps`);
  if (triggers.length) out.push(`Full-mode triggers detected: ${triggers.join('; ')}. Consider /altitude full.`);
}

// Hook commands whose script file is missing would fail silently on every call.
const settings = read('.claude/settings.json');
if (settings) {
  const broken = [];
  for (const m of settings.matchAll(/"command":\s*"([^"]+)"/g)) {
    const script = m[1].match(/(?:node|bash|sh)\s+([^\s"]+)/);
    if (script && !fs.existsSync(rel(script[1]))) broken.push(script[1]);
  }
  if (broken.length) out.push(`HOOKS BROKEN: missing ${broken.join(', ')}`);
}

process.stdout.write(out.join('\n') + '\n');
