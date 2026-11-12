// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Table-driven self-check for the PR comment renderer.
 * Runs on every `npm run validate`.
 *
 * Usage: node --no-warnings scripts/check-ci-pr-comment.mjs
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { renderNowPassingComment, renderResolvedComment, MARKER } from './lib/ci-pr-comment.mjs';

const renderScript = join(dirname(fileURLToPath(import.meta.url)), 'render-pr-comment.mjs');

const ctx = { runUrl: 'https://github.com/org/repo/actions/runs/12345', sha: 'abc1234567890123456789012345678901234567' };

// Test cases: [description, testFn, expectedResult]
const CASES = [
  [
    'renderNowPassingComment with no nowPassing items → null',
    () => renderNowPassingComment([{ app: 'cite', nowPassing: [] }], ctx),
    (r) => r === null,
  ],
  [
    'renderNowPassingComment with one gallery item → contains expected content',
    () => {
      const evals = [
        {
          app: 'gallery',
          nowPassing: [
            {
              file: 'gallery/tests/test.spec.ts',
              title: 'Test > Works',
              reason: 'App bug #123',
              tracking: 'https://github.com/org/repo/issues/123',
            },
          ],
        },
      ];
      return renderNowPassingComment(evals, ctx);
    },
    (r) => {
      if (typeof r !== 'string') return false;
      if (!r.startsWith(MARKER)) return false;
      if (!r.includes('ci/known-failures.json')) return false;
      if (!r.includes('`gallery/tests/test.spec.ts :: Test > Works`')) return false;
      if (!r.includes(ctx.runUrl)) return false;
      // Check for JSON block and parse it
      const jsonMatch = r.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) return false;
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (!Array.isArray(parsed)) return false;
        if (parsed.length !== 1) return false;
        const entry = parsed[0];
        return (
          entry.file === 'gallery/tests/test.spec.ts' &&
          entry.title === 'Test > Works' &&
          entry.reason === 'App bug #123' &&
          entry.tracking === 'https://github.com/org/repo/issues/123'
        );
      } catch {
        return false;
      }
    },
  ],
  [
    'renderNowPassingComment with player and alloy → alloy appears before player',
    () => {
      const evals = [
        {
          app: 'player',
          nowPassing: [{ file: 'player/tests/a.spec.ts', title: 'Player Test', reason: 'reason1' }],
        },
        {
          app: 'alloy',
          nowPassing: [{ file: 'alloy/tests/b.spec.ts', title: 'Alloy Test', reason: 'reason2' }],
        },
      ];
      return renderNowPassingComment(evals, ctx);
    },
    (r) => {
      if (typeof r !== 'string') return false;
      const alloyIdx = r.indexOf('alloy');
      const playerIdx = r.indexOf('player');
      return alloyIdx > 0 && playerIdx > 0 && alloyIdx < playerIdx;
    },
  ],
  [
    'renderNowPassingComment without tracking → cell is —',
    () => {
      const evals = [
        {
          app: 'cite',
          nowPassing: [{ file: 'cite/tests/test.spec.ts', title: 'Test', reason: 'No tracking' }],
        },
      ];
      return renderNowPassingComment(evals, ctx);
    },
    (r) => {
      if (typeof r !== 'string') return false;
      // Find the table row with this test
      const lines = r.split('\n');
      const testRow = lines.find((line) => line.includes('`cite/tests/test.spec.ts :: Test`'));
      if (!testRow) return false;
      // Split by | and check that tracking cell is —
      const cells = testRow.split('|').map((c) => c.trim());
      // Expect: | Test | Listed reason | Tracking |
      // cells[0] is empty (before first |), cells[1] is Test, cells[2] is reason, cells[3] is tracking, cells[4] is empty (after last |)
      return cells.length === 5 && cells[3] === '—';
    },
  ],
  [
    'renderNowPassingComment with title containing | and backtick → table still has 3 cells',
    () => {
      const evals = [
        {
          app: 'gallery',
          nowPassing: [{ file: 'gallery/tests/test.spec.ts', title: 'Test | with `backtick`', reason: 'reason' }],
        },
      ];
      return renderNowPassingComment(evals, ctx);
    },
    (r) => {
      if (typeof r !== 'string') return false;
      const lines = r.split('\n');
      const testRow = lines.find((line) => line.includes('gallery/tests/test.spec.ts'));
      if (!testRow) return false;
      // Count the number of | separators
      const cells = testRow.split('|').filter((c) => c.trim().length > 0);
      // Should have exactly 3 cells: Test, Listed reason, Tracking
      return cells.length === 3;
    },
  ],
  [
    'renderResolvedComment → starts with MARKER',
    () => renderResolvedComment(ctx),
    (r) => typeof r === 'string' && r.startsWith(MARKER),
  ],
  [
    'renderResolvedComment → real newline after MARKER and the run link',
    () => renderResolvedComment(ctx),
    (r) => r.startsWith(MARKER + '\n\n') && !r.includes('\\n') && r.includes(`(${ctx.runUrl})`),
  ],
  [
    'render-pr-comment.mjs ignores e2e-eval-confirm-<app>/ directories',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'check-ci-pr-comment-'));
      try {
        const write = (name, nowPassing) => {
          mkdirSync(join(dir, name));
          // A confirming rerun records the same app name as the first pass.
          writeFileSync(join(dir, name, 'ci-evaluation.json'), JSON.stringify({ app: 'cite', nowPassing }));
        };
        write('e2e-eval-cite', [{ file: 'cite/tests/first.spec.ts', title: 'First', reason: 'r1' }]);
        write('e2e-eval-confirm-cite', [{ file: 'cite/tests/confirm.spec.ts', title: 'Confirm', reason: 'r2' }]);
        const res = spawnSync(process.execPath, ['--no-warnings', renderScript, '--dir', dir, '--run-url', ctx.runUrl, '--sha', ctx.sha], { encoding: 'utf8' });
        return { status: res.status, out: res.stdout };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    (r) => r.status === 0 && r.out.includes('`cite/tests/first.spec.ts :: First`') && !r.out.includes('confirm.spec.ts'),
  ],
  [
    'render-pr-comment.mjs --resolved → prints the resolved body',
    () => spawnSync(process.execPath, ['--no-warnings', renderScript, '--resolved', '--run-url', ctx.runUrl, '--sha', ctx.sha], { encoding: 'utf8' }),
    (r) => r.status === 0 && r.stdout.trimEnd() === renderResolvedComment(ctx),
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
