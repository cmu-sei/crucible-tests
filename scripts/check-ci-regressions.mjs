// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Table-driven self-check for the regression issue renderer.
 * Runs on every `npm run validate`.
 *
 * Usage: node --no-warnings scripts/check-ci-regressions.mjs
 */

import {
  confirmedRegressions,
  digestDiff,
  renderRegressionIssue,
  renderRecurrenceComment,
  renderRecoveredComment,
  mentionFor,
  classifyWeeklyRun,
  renderDidNotRunIssue,
  renderDidNotRunComment,
  renderRunSummary,
  planRegressionReport,
} from './lib/ci-regressions.mjs';
import { lintLists } from './lib/ci-results.mjs';

const ctx = {
  runUrl: 'https://github.com/org/repo/actions/runs/12345',
  mention: '@test-team',
};

// Sample test keys
const A = { file: 'cite/tests/a.spec.ts', title: 'Test A › Should work' };
const B = { file: 'cite/tests/b.spec.ts', title: 'Test B › Should work' };
const C = { file: 'gallery/tests/c.spec.ts', title: 'Test C › Should work' };

// Evaluation builders for the weekly-run classification cases
const evalOf = (over = {}) => ({ ok: true, didNotRun: false, globalErrors: [], newFailures: [], ...over });
const planCtx = { currentDigests: {}, lastCleanDigests: null, runUrl: ctx.runUrl, repo: 'someone/crucible-tests' };

// Test cases: [description, testFn, expectedResult]
const CASES = [
  [
    'classifyWeeklyRun with no first-pass evaluation → didNotRun (missing)',
    () => classifyWeeklyRun(null, null),
    (r) => r.status === 'didNotRun' && r.missingEvaluation === true,
  ],
  [
    'classifyWeeklyRun with didNotRun → didNotRun',
    () => classifyWeeklyRun(evalOf({ ok: false, didNotRun: true }), null),
    (r) => r.status === 'didNotRun' && !r.missingEvaluation,
  ],
  [
    'classifyWeeklyRun with global errors → didNotRun with the messages',
    () => classifyWeeklyRun(evalOf({ ok: false, globalErrors: ['Error: global setup failed'] }), null),
    (r) => r.status === 'didNotRun' && r.globalErrors[0] === 'Error: global setup failed',
  ],
  [
    'classifyWeeklyRun clean → clean',
    () => classifyWeeklyRun(evalOf(), null),
    (r) => r.status === 'clean',
  ],
  [
    'classifyWeeklyRun with a reproduced new failure → regression',
    () => classifyWeeklyRun(evalOf({ ok: false, newFailures: [A, B] }), evalOf({ ok: false, newFailures: [B] })),
    (r) => r.status === 'regression' && r.keys.length === 1 && r.keys[0].file === B.file,
  ],
  [
    'classifyWeeklyRun with a confirm run that passed → notReproduced',
    () => classifyWeeklyRun(evalOf({ ok: false, newFailures: [A] }), evalOf()),
    (r) => r.status === 'notReproduced' && r.newFailureCount === 1,
  ],
  [
    'classifyWeeklyRun with no confirm evaluation → confirmCrashed',
    () => classifyWeeklyRun(evalOf({ ok: false, newFailures: [A] }), null),
    (r) => r.status === 'confirmCrashed',
  ],
  [
    'classifyWeeklyRun with a confirm run that did not run → confirmCrashed',
    () => classifyWeeklyRun(evalOf({ ok: false, newFailures: [A] }), evalOf({ ok: false, didNotRun: true })),
    (r) => r.status === 'confirmCrashed',
  ],
  [
    'classifyWeeklyRun failing without new failures (skip leak) → otherFailure',
    () => classifyWeeklyRun(evalOf({ ok: false, skipLeaks: [A] }), null),
    (r) => r.status === 'otherFailure',
  ],
  [
    'renderRunSummary wording differs for notReproduced, confirmCrashed and didNotRun',
    () => [
      renderRunSummary('cite', classifyWeeklyRun(evalOf({ ok: false, newFailures: [A] }), evalOf())),
      renderRunSummary('cite', classifyWeeklyRun(evalOf({ ok: false, newFailures: [A] }), null)),
      renderRunSummary('cite', classifyWeeklyRun(null, null)),
    ],
    ([notRepro, crashed, didNotRun]) =>
      notRepro.includes('did not reproduce') && !notRepro.includes('crashed') &&
      crashed.includes('Confirm rerun crashed') && !crashed.includes('did not reproduce') &&
      didNotRun.includes('Suite did not run'),
  ],
  [
    'renderDidNotRunIssue → marker, mention, "suite did not run", global errors, run link',
    () => renderDidNotRunIssue('cite', classifyWeeklyRun(evalOf({ ok: false, globalErrors: ['\x1b[31mError: realm import failed\x1b[39m\n  at x.ts:1'] }), null), [], ctx),
    (r) =>
      r.title === 'E2E regression: cite' &&
      r.body.startsWith('<!-- crucible-tests:e2e-regression:cite -->') &&
      r.body.includes(ctx.mention) &&
      r.body.includes('suite did not run') &&
      r.body.includes('`Error: realm import failed`') &&
      !r.body.includes('\x1b') &&
      r.body.includes(`[Run](${ctx.runUrl})`),
  ],
  [
    'renderDidNotRunIssue with a missing evaluation → says the job left no evaluation',
    () => renderDidNotRunIssue('cite', classifyWeeklyRun(null, null), [], ctx),
    (r) => r.body.includes('left no evaluation'),
  ],
  [
    'renderDidNotRunComment → heading, run link and errors',
    () => renderDidNotRunComment(classifyWeeklyRun(evalOf({ ok: false, globalErrors: ['Boom'] }), null), [], ctx),
    (r) => r.startsWith('## Suite did not run') && r.includes(ctx.runUrl) && r.includes('`Boom`'),
  ],
  [
    'planRegressionReport: clean → recovered with the closing comment',
    () => planRegressionReport('cite', evalOf(), null, planCtx),
    (r) => r.action === 'recovered' && r.recoveredBody.includes('closing') && r.summary.includes('Clean'),
  ],
  [
    'planRegressionReport: did not run → did-not-run issue that never closes',
    () => planRegressionReport('cite', null, null, planCtx),
    (r) => r.action === 'did-not-run' && r.title === 'E2E regression: cite' &&
      r.issueBody.includes('`@cmu-sei/crucible-code-owners`') && r.recurrenceBody.includes('Suite did not run') &&
      r.recoveredBody === undefined,
  ],
  [
    'planRegressionReport: regression → regression issue and recurrence body',
    () => planRegressionReport('cite', evalOf({ ok: false, newFailures: [A] }), evalOf({ ok: false, newFailures: [A] }), planCtx),
    (r) => r.action === 'regression' && r.issueBody.includes(`${A.file} :: ${A.title}`) && r.recurrenceBody.includes('Recurrence'),
  ],
  [
    'planRegressionReport: notReproduced and confirmCrashed → no action',
    () => [
      planRegressionReport('cite', evalOf({ ok: false, newFailures: [A] }), evalOf(), planCtx),
      planRegressionReport('cite', evalOf({ ok: false, newFailures: [A] }), null, planCtx),
    ],
    (rs) => rs.every((r) => r.action === 'none' && r.issueBody === undefined),
  ],
  [
    'confirmedRegressions with intersecting failures → returns intersection',
    () => confirmedRegressions({ newFailures: [A, B] }, { newFailures: [B] }),
    (r) => Array.isArray(r) && r.length === 1 && r[0].file === B.file && r[0].title === B.title,
  ],
  [
    'confirmedRegressions with null confirm → returns []',
    () => confirmedRegressions({ newFailures: [A] }, null),
    (r) => Array.isArray(r) && r.length === 0,
  ],
  [
    'digestDiff with changed service → returns diff',
    () => digestDiff({ x: 'i@sha256:2', y: 'j@sha256:1' }, { x: 'i@sha256:1', y: 'j@sha256:1' }),
    (r) =>
      Array.isArray(r) &&
      r.length === 1 &&
      r[0].service === 'x' &&
      r[0].from === 'i@sha256:1' &&
      r[0].to === 'i@sha256:2',
  ],
  [
    'digestDiff with null lastClean → returns []',
    () => digestDiff({ x: 'i@sha256:2' }, null),
    (r) => Array.isArray(r) && r.length === 0,
  ],
  [
    'renderRegressionIssue title → E2E regression: <app>',
    () => renderRegressionIssue('cite', [A], [], ctx),
    (r) => r && r.title === 'E2E regression: cite',
  ],
  [
    'renderRegressionIssue body → contains marker, mention, key, and run link',
    () => renderRegressionIssue('cite', [A], [], ctx),
    (r) => {
      if (!r || typeof r.body !== 'string') return false;
      if (!r.body.includes('<!-- crucible-tests:e2e-regression:cite -->')) return false;
      if (!r.body.includes(ctx.mention)) return false;
      if (!r.body.includes(`${A.file} :: ${A.title}`)) return false;
      if (!r.body.includes(ctx.runUrl)) return false;
      return true;
    },
  ],
  [
    'renderRegressionIssue with no diff → contains "no earlier clean run to compare"',
    () => renderRegressionIssue('cite', [A], [], ctx),
    (r) => r && r.body.includes('no earlier clean run to compare'),
  ],
  [
    'renderRegressionIssue with a clean run but no diff → says no image changed',
    () => renderRegressionIssue('cite', [A], [], { ...ctx, hasLastClean: true }),
    (r) => r && r.body.includes('No image digest changed') && !r.body.includes('no earlier clean run'),
  ],
  [
    'renderRegressionIssue details block → parses and passes lintLists (except TODO)',
    () => renderRegressionIssue('cite', [A, B], [], ctx),
    (r) => {
      if (!r || typeof r.body !== 'string') return false;
      // Extract JSON from details block
      const jsonMatch = r.body.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) return false;
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (!Array.isArray(parsed) || parsed.length !== 2) return false;

        // Check that entries have required fields
        for (const entry of parsed) {
          if (!entry.file || !entry.title || !entry.reason || !entry.added) return false;
        }

        // Run lintLists with a version that has real reasons instead of TODO
        const withRealReasons = parsed.map((e) => ({
          ...e,
          reason: 'Real reason',
        }));

        const errors = lintLists(withRealReasons, []);
        // Should have no errors (file existence errors are expected in tests)
        return errors.filter(e => !e.includes('nonexistent file')).length === 0;
      } catch {
        return false;
      }
    },
  ],
  [
    'mentionFor cmu-sei/crucible-tests → live mention',
    () => mentionFor('cmu-sei/crucible-tests'),
    (r) => r === '@cmu-sei/crucible-code-owners',
  ],
  [
    'mentionFor other repo → backticked mention',
    () => mentionFor('someone/crucible-tests'),
    (r) => r === '`@cmu-sei/crucible-code-owners`',
  ],
  [
    'renderRecoveredComment → contains "closing"',
    () => renderRecoveredComment('cite', ctx),
    (r) => typeof r === 'string' && r.toLowerCase().includes('closing'),
  ],
  [
    'renderRecurrenceComment → contains keys and run link',
    () => renderRecurrenceComment([A], [], ctx),
    (r) => {
      if (typeof r !== 'string') return false;
      if (!r.includes(`${A.file} :: ${A.title}`)) return false;
      if (!r.includes(ctx.runUrl)) return false;
      return true;
    },
  ],
];

// Run all test cases
let failed = 0;
for (const [desc, testFn, expectFn] of CASES) {
  try {
    const result = testFn();
    const pass = expectFn(result);
    if (pass) {
      console.log(`✓ ${desc}`);
    } else {
      console.error(`✗ ${desc}`);
      console.error('  Result did not match expectations');
      failed++;
    }
  } catch (err) {
    console.error(`✗ ${desc}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${CASES.length} tests passed`);
