const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { earlyPacing } = require('./early-pacing.cjs');

// Recorded before automatic work, with Assign work clicked every 500ms.
const baseline = fs.readFileSync(path.join(__dirname, 'assistant-pacing-baseline.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));

for (const delegateOnly of [false, true]) {
  test(`weaker assistant reaches Basic AI without stalling (${delegateOnly ? 'delegated' : 'active'} play)`, t => {
    for (const before of baseline.filter(item => item.delegateOnly === delegateOnly)) {
      const after = earlyPacing(before.seed, delegateOnly);
      assert.equal(after.length, 2);
      for (const [index, current] of after.entries()) {
        const previous = before.milestones[index];
        assert.equal(current.phase, previous.phase);
        assert.ok(current.seconds > previous.seconds, 'The weaker sequential assistant slows the old concurrent pace');
        assert.ok(current.seconds <= (delegateOnly ? 720 : 240), 'Basic AI stays reachable within the intended active or delegated pacing window');
        assert.ok(Math.abs(current.tasks / previous.tasks - 1) <= 0.12, 'Completed task counts remain within 12%');
        assert.ok(Math.abs(current.earned / previous.earned - 1) <= 0.15, 'Total earnings remain within 15%');
        if (delegateOnly) assert.ok(current.clicks < previous.clicks, 'Delegation removes assignment clicks');
      }
      t.diagnostic(JSON.stringify({ seed: before.seed, delegateOnly, milestones: after }));
    }

  });
}
