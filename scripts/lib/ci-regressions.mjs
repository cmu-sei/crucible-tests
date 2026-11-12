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
  lines.push('## Changed images since last clean weekly run');
  lines.push('');

  if (diff.length === 0) {
    lines.push(ctx.hasLastClean
      ? 'No image digest changed since the last clean weekly run.'
      : 'no earlier clean run to compare');
  } else {
    lines.push('| Service | From | To |');
    lines.push('|---|---|---|');
    for (const { service, from, to } of diff) {
      const fromCell = from ? `\`${from}\`` : '—';
      lines.push(`| ${service} | ${fromCell} | \`${to}\` |`);
    }
  }

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
