// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * PR comment renderer: renders sticky "now passing" comments for tests
 * that were listed in known-failures.json but passed in the current run.
 */

export const MARKER = '<!-- crucible-tests:e2e-now-passing -->';

/**
 * Escape markdown table cell content.
 * Content in code spans doesn't need pipe escaping, but backticks need doubling.
 */
function escapeTableCell(text) {
  // For content inside backticks, we don't escape pipes
  // For backticks in the text, we use HTML entity to avoid breaking the code span
  return text.replace(/`/g, '&#96;').replace(/\|/g, '&#124;');
}

/**
 * Render a PR comment for tests that are now passing.
 * @param {Array<{app: string, nowPassing: Array<{file: string, title: string, reason?: string, tracking?: string}>}>} evals
 * @param {{runUrl: string, sha: string}} ctx
 * @returns {string | null} Markdown content or null if no nowPassing items
 */
export function renderNowPassingComment(evals, ctx) {
  // Filter out e2e-eval-confirm-* artifacts (Task 8 will add these later)
  const filteredEvals = evals.filter((e) => !e.app.startsWith('e2e-eval-confirm-'));

  // Aggregate all nowPassing items
  const allNowPassing = filteredEvals.flatMap((e) =>
    e.nowPassing.map((item) => ({ ...item, app: e.app }))
  );

  if (allNowPassing.length === 0) {
    return null;
  }

  // Sort by app alphabetically, then by test key within each app
  allNowPassing.sort((a, b) => {
    const appCmp = a.app.localeCompare(b.app);
    if (appCmp !== 0) return appCmp;
    const keyA = `${a.file} :: ${a.title}`;
    const keyB = `${b.file} :: ${b.title}`;
    return keyA.localeCompare(keyB);
  });

  const shortSha = ctx.sha.substring(0, 7);
  const lines = [];

  lines.push(MARKER);
  lines.push('');
  lines.push('## Known failures now passing');
  lines.push('');
  lines.push(
    `These tests are listed in \`ci/known-failures.json\` but passed in [this run](${ctx.runUrl}) at \`${shortSha}\`. ` +
      `If this PR fixed them, or the app fix has landed, remove their entries so the list keeps reflecting what is actually broken.`
  );
  lines.push('');

  // Group by app
  const byApp = new Map();
  for (const item of allNowPassing) {
    if (!byApp.has(item.app)) {
      byApp.set(item.app, []);
    }
    byApp.get(item.app).push(item);
  }

  // Render table grouped by app
  lines.push('| Test | Listed reason | Tracking |');
  lines.push('|---|---|---|');

  for (const [app, items] of byApp) {
    lines.push(`| **${app}** | | |`);
    for (const item of items) {
      const testKey = `${item.file} :: ${item.title}`;
      const escapedKey = escapeTableCell(testKey);
      const reason = escapeTableCell(item.reason || '—');
      const tracking = item.tracking ? escapeTableCell(item.tracking) : '—';
      lines.push(`| \`${escapedKey}\` | ${reason} | ${tracking} |`);
    }
  }

  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Entries to remove</summary>');
  lines.push('');
  lines.push('```json');

  // Build the exact entries array as they appear in the list
  const entries = allNowPassing.map((item) => {
    const entry = {
      file: item.file,
      title: item.title,
    };
    if (item.reason !== undefined) entry.reason = item.reason;
    if (item.tracking !== undefined) entry.tracking = item.tracking;
    // Assume 'added' field exists in the original list, but we don't have it here.
    // The evaluator doesn't return it, so we omit it from the output.
    // The user will need to find and delete the matching entries by file+title.
    return entry;
  });

  lines.push(JSON.stringify(entries, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</details>');

  return lines.join('\n');
}

/**
 * Render a resolved comment (all nowPassing items have been removed or no longer pass).
 * @param {{runUrl: string, sha: string}} ctx
 * @returns {string}
 */
export function renderResolvedComment(ctx) {
  return (
    MARKER +
    '\n\n' +
    `All known failures previously reported as passing on this PR have been removed from the list, or no longer pass. [Run](${ctx.runUrl})`
  );
}
