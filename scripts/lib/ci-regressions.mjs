// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * CI regression issue logic: identifies confirmed regressions from weekly runs
 * and renders GitHub issue bodies.
 */

/**
 * Returns the intersection of newFailures from first and confirm evaluations.
 * A null confirm (crashed run) returns [].
 * @param {Object} first - First evaluation with {newFailures: Key[]}
 * @param {Object|null} confirm - Confirm evaluation or null
 * @returns {Array<{file: string, title: string}>}
 */
export function confirmedRegressions(first, confirm) {
  if (!confirm) return [];

  const firstKeys = new Set(
    first.newFailures.map((k) => `${k.file}::${k.title}`)
  );

  return confirm.newFailures.filter((k) =>
    firstKeys.has(`${k.file}::${k.title}`)
  );
}

/**
 * Returns services whose digest changed between current and lastClean runs.
 * A null lastClean returns [].
 * @param {Record<string, string>} current - { service: "image@sha256:digest" }
 * @param {Record<string, string>|null} lastClean - { service: "image@sha256:digest" }
 * @returns {Array<{service: string, from: string|null, to: string}>}
 */
export function digestDiff(current, lastClean) {
  if (!lastClean) return [];

  const diff = [];
  for (const [service, to] of Object.entries(current)) {
    const from = lastClean[service];
    if (from && from !== to) {
      diff.push({ service, from, to });
    }
  }

  return diff.sort((a, b) => a.service.localeCompare(b.service));
}

/**
 * Returns team mention string: live only in cmu-sei/crucible-tests, backticked elsewhere.
 * @param {string} repo - "owner/repo"
 * @returns {string}
 */
export function mentionFor(repo) {
  return repo === 'cmu-sei/crucible-tests'
    ? '@cmu-sei/crucible-code-owners'
    : '`@cmu-sei/crucible-code-owners`';
}

/**
 * Render a regression issue body.
 * @param {string} app - App name
 * @param {Array<{file: string, title: string}>} keys - Failing test keys
 * @param {Array<{service: string, from: string|null, to: string}>} diff - Image digest changes
 * @param {{runUrl: string, mention: string, hasLastClean?: boolean}} ctx - hasLastClean: an
 *   earlier clean weekly run was found, so an empty diff means no image changed
 * @returns {{title: string, body: string}}
 */
export function renderRegressionIssue(app, keys, diff, ctx) {
  const lines = [];

  lines.push(`<!-- crucible-tests:e2e-regression:${app} -->`);
  lines.push('');
  lines.push(ctx.mention);
  lines.push('');
  lines.push(`## E2E regression in **${app}**`);
  lines.push('');
  lines.push('The following tests failed in a weekly run and failed again on a confirming rerun:');
  lines.push('');

  for (const key of keys) {
    lines.push(`- \`${key.file} :: ${key.title}\``);
  }

  lines.push('');
  imagesSection(lines, diff, ctx.hasLastClean, '## Changed images since last clean weekly run');
  lines.push('');
  lines.push(`[Run](${ctx.runUrl})`);
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>If this is a real app bug, add to known-failures.json</summary>');
  lines.push('');
  lines.push('```json');

  const runDate = new Date().toISOString().split('T')[0];
  const entries = keys.map((k) => ({
    file: k.file,
    title: k.title,
    reason: 'TODO: describe the bug',
    added: runDate,
  }));

  lines.push(JSON.stringify(entries, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</details>');

  return {
    title: `E2E regression: ${app}`,
    body: lines.join('\n'),
  };
}

/**
 * Render a recurrence comment for an existing issue.
 * @param {Array<{file: string, title: string}>} keys - Failing test keys
 * @param {Array<{service: string, from: string|null, to: string}>} diff - Image digest changes
 * @param {{runUrl: string}} ctx
 * @returns {string}
 */
export function renderRecurrenceComment(keys, diff, ctx) {
  const lines = [];

  lines.push('## Recurrence');
  lines.push('');
  lines.push(`Still failing in [this run](${ctx.runUrl}):`);
  lines.push('');

  for (const key of keys) {
    lines.push(`- \`${key.file} :: ${key.title}\``);
  }

  if (diff.length > 0) {
    lines.push('');
    lines.push('### Image changes since last clean weekly run');
    lines.push('');
    lines.push('| Service | From | To |');
    lines.push('|---|---|---|');
    for (const { service, from, to } of diff) {
      const fromCell = from ? `\`${from}\`` : '—';
      lines.push(`| ${service} | ${fromCell} | \`${to}\` |`);
    }
  }

  return lines.join('\n');
}

/**
 * Render a recovered comment (all tests passing).
 * @param {string} app - App name
 * @param {{runUrl: string}} ctx
 * @returns {string}
 */
export function renderRecoveredComment(app, ctx) {
  return `Passing again in [this run](${ctx.runUrl}); closing.`;
}

/**
 * Classify one app's weekly first pass together with its confirming rerun.
 *
 * - didNotRun: the suite or the stack did not run (no evaluation at all, didNotRun, or
 *   global errors). Filed as its own kind of regression issue.
 * - clean: the first pass is ok with no new failures. Closes an open issue.
 * - regression: new failures that failed again on the confirming rerun. Filed.
 * - notReproduced: the confirming rerun ran and none of the new failures failed again.
 * - confirmCrashed: there were new failures, but the confirming rerun left no usable
 *   result, so they stay unconfirmed.
 * - otherFailure: the first pass failed for another reason (for example, the skip list
 *   was not applied) without any new failure.
 * Only didNotRun and regression file an issue; only clean closes one.
 *
 * @param {Object|null} first - First-pass evaluation; null when the app was in the matrix
 *   but left no evaluation artifact
 * @param {Object|null} confirm - Confirming-rerun evaluation, or null when none exists
 * @returns {{status: string, keys: Array<{file: string, title: string}>, globalErrors: string[], missingEvaluation: boolean, newFailureCount: number}}
 */
export function classifyWeeklyRun(first, confirm) {
  const result = { status: '', keys: [], globalErrors: [], missingEvaluation: false, newFailureCount: 0 };

  if (!first) {
    return { ...result, status: 'didNotRun', missingEvaluation: true };
  }

  const newFailures = first.newFailures || [];
  result.newFailureCount = newFailures.length;
  const confirmUsable = confirm && !confirm.didNotRun && (confirm.globalErrors || []).length === 0;
  result.keys = confirm ? confirmedRegressions({ newFailures }, { newFailures: confirm.newFailures || [] }) : [];

  if (first.didNotRun || (first.globalErrors || []).length > 0) {
    return { ...result, status: 'didNotRun', globalErrors: first.globalErrors || [] };
  }
  if (first.ok && newFailures.length === 0) {
    return { ...result, status: 'clean' };
  }
  if (newFailures.length === 0) {
    return { ...result, status: 'otherFailure' };
  }
  if (result.keys.length > 0) {
    return { ...result, status: 'regression' };
  }
  return { ...result, status: confirmUsable ? 'notReproduced' : 'confirmCrashed' };
}

function imagesSection(lines, diff, hasLastClean, heading) {
  lines.push(heading);
  lines.push('');
  if (diff.length === 0) {
    lines.push(hasLastClean
      ? 'No image digest changed since the last clean weekly run.'
      : 'no earlier clean run to compare');
    return;
  }
  lines.push('| Service | From | To |');
  lines.push('|---|---|---|');
  for (const { service, from, to } of diff) {
    const fromCell = from ? `\`${from}\`` : '—';
    lines.push(`| ${service} | ${fromCell} | \`${to}\` |`);
  }
}

function didNotRunDetails(lines, info) {
  if (info.missingEvaluation) {
    lines.push('The job left no evaluation, so the stack or the job itself failed before the suite could run.');
  } else if (info.globalErrors.length > 0) {
    lines.push('Playwright reported these global errors:');
    lines.push('');
    for (const err of info.globalErrors) {
      // First line only, without ANSI colours, and short enough to read in a list.
      const firstLine = String(err).replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 300);
      lines.push(`- \`${firstLine.replace(/`/g, "'")}\``);
    }
  } else {
    lines.push('Playwright produced no results for this app.');
  }
  if (info.keys.length > 0) {
    lines.push('');
    lines.push('These new failures also failed again on the confirming rerun:');
    lines.push('');
    for (const key of info.keys) {
      lines.push(`- \`${key.file} :: ${key.title}\``);
    }
  }
}

/**
 * Render a regression issue body for a weekly run in which the app's suite did not run.
 * Uses the same marker and title as renderRegressionIssue, so it opens or updates the
 * app's one regression issue.
 * @param {string} app - App name
 * @param {{globalErrors: string[], missingEvaluation: boolean, keys: Array<{file: string, title: string}>}} info
 * @param {Array<{service: string, from: string|null, to: string}>} diff - Image digest changes
 * @param {{runUrl: string, mention: string, hasLastClean?: boolean}} ctx
 * @returns {{title: string, body: string}}
 */
export function renderDidNotRunIssue(app, info, diff, ctx) {
  const lines = [];
  lines.push(`<!-- crucible-tests:e2e-regression:${app} -->`);
  lines.push('');
  lines.push(ctx.mention);
  lines.push('');
  lines.push(`## E2E suite did not run for **${app}**`);
  lines.push('');
  lines.push('The weekly run could not run this app\'s suite, so none of its tests were checked.');
  lines.push('');
  didNotRunDetails(lines, info);
  lines.push('');
  imagesSection(lines, diff, ctx.hasLastClean, '## Changed images since last clean weekly run');
  lines.push('');
  lines.push(`[Run](${ctx.runUrl})`);
  return { title: `E2E regression: ${app}`, body: lines.join('\n') };
}

/**
 * Render a comment for an existing issue when the suite did not run again.
 * @param {{globalErrors: string[], missingEvaluation: boolean, keys: Array<{file: string, title: string}>}} info
 * @param {Array<{service: string, from: string|null, to: string}>} diff
 * @param {{runUrl: string}} ctx
 * @returns {string}
 */
export function renderDidNotRunComment(info, diff, ctx) {
  const lines = [];
  lines.push('## Suite did not run');
  lines.push('');
  lines.push(`The suite did not run in [this run](${ctx.runUrl}).`);
  lines.push('');
  didNotRunDetails(lines, info);
  if (diff.length > 0) {
    lines.push('');
    imagesSection(lines, diff, true, '### Image changes since last clean weekly run');
  }
  return lines.join('\n');
}

const SUMMARY = {
  clean: (c) => ['Clean', 'No new failures. Any open regression issue is closed.'],
  didNotRun: (c) => ['Suite did not run', c.missingEvaluation
    ? 'The job left no evaluation. Opened or updated the regression issue.'
    : 'The suite did not run or reported global errors. Opened or updated the regression issue.'],
  regression: (c) => ['Regression reported', `${c.keys.length} test(s) failed again on the confirming rerun. Opened or updated the regression issue.`],
  notReproduced: (c) => ['New failures did not reproduce', `${c.newFailureCount} new failure(s) passed on the confirming rerun. No issue filed.`],
  confirmCrashed: (c) => ['Confirm rerun crashed', `The confirming rerun left no usable result, so ${c.newFailureCount} new failure(s) stay unconfirmed. No issue filed.`],
  otherFailure: (c) => ['Failed without new failures', 'The first pass failed (for example, the skip list was not applied) but had no new failure. See its job summary. No issue filed.'],
};

/**
 * Render the job-summary lines for one app.
 * @param {string} app
 * @param {ReturnType<typeof classifyWeeklyRun>} classification
 * @returns {string}
 */
export function renderRunSummary(app, classification) {
  const [heading, text] = SUMMARY[classification.status](classification);
  return `## ${app}: ${heading}\n${text}\n`;
}

/**
 * Decide what the regressions job does for one app and render every body it needs.
 * @param {string} app
 * @param {Object|null} first - First-pass evaluation, null when missing
 * @param {Object|null} confirm - Confirming-rerun evaluation, null when missing
 * @param {{currentDigests: Record<string, string>, lastCleanDigests: Record<string, string>|null, runUrl: string, repo: string}} ctx
 * @returns {{action: 'recovered'|'did-not-run'|'regression'|'none', status: string, summary: string, title?: string, issueBody?: string, recurrenceBody?: string, recoveredBody?: string}}
 */
export function planRegressionReport(app, first, confirm, ctx) {
  const classification = classifyWeeklyRun(first, confirm);
  const summary = renderRunSummary(app, classification);
  const out = { status: classification.status, summary };

  if (classification.status === 'clean') {
    return { ...out, action: 'recovered', recoveredBody: renderRecoveredComment(app, { runUrl: ctx.runUrl }) };
  }
  if (classification.status !== 'didNotRun' && classification.status !== 'regression') {
    return { ...out, action: 'none' };
  }

  const diff = digestDiff(ctx.currentDigests || {}, ctx.lastCleanDigests);
  const renderCtx = { runUrl: ctx.runUrl, mention: mentionFor(ctx.repo), hasLastClean: ctx.lastCleanDigests != null };

  if (classification.status === 'didNotRun') {
    const issue = renderDidNotRunIssue(app, classification, diff, renderCtx);
    return {
      ...out,
      action: 'did-not-run',
      title: issue.title,
      issueBody: issue.body,
      recurrenceBody: renderDidNotRunComment(classification, diff, { runUrl: ctx.runUrl }),
    };
  }

  const issue = renderRegressionIssue(app, classification.keys, diff, renderCtx);
  return {
    ...out,
    action: 'regression',
    title: issue.title,
    issueBody: issue.body,
    recurrenceBody: renderRecurrenceComment(classification.keys, diff, { runUrl: ctx.runUrl }),
  };
}
