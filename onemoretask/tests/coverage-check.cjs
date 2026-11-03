const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// The release baseline stays fixed so the check also works after committing this work.
const baseline = '45bc33c';
const filename = path.resolve(__dirname, '../game.js');
const report = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../coverage/coverage-final.json'), 'utf8'))[filename];
const source = fs.readFileSync(filename, 'utf8').split('\n');
const diff = execFileSync('git', ['diff', baseline, '--unified=0', '--', filename], { encoding: 'utf8' });
const changed = new Set();
let line = 0;
for (const text of diff.split('\n')) {
  const hunk = text.match(/^@@.*\+(\d+)/);
  if (hunk) { line = Number(hunk[1]); continue; }
  if (text.startsWith('+') && !text.startsWith('+++')) changed.add(line++);
  else if (!text.startsWith('-') && !text.startsWith('\\')) line++;
}
const checked = new Map();
for (const [id, location] of Object.entries(report.statementMap)) {
  const n = location.start.line;
  if (changed.has(n) && source[n-1].trim() && !/^\s*(\/\/|\/\*|\*)/.test(source[n-1])) checked.set(n, (checked.get(n) || 0) + report.s[id]);
}
const missing = [...checked].filter(([, count]) => count === 0).map(([n]) => n);
console.log(`Changed-line coverage: ${checked.size - missing.length}/${checked.size} (${((checked.size - missing.length) / checked.size * 100).toFixed(2)}%)`);
for (const n of missing) console.log(`${n}: ${source[n-1].trim()}`);
if (missing.length) process.exitCode = 1;
