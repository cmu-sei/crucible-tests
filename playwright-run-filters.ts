// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import fs from 'fs';
import path from 'path';

/**
 * `playwright test` options (long and short forms) and how many following arguments
 * each consumes, mirrored from `npx playwright test --help`. Anything not listed here
 * is a flag that takes no value.
 *
 * - `required`: always consumes the next argument (`--grep x`, `-g x`).
 * - `optional`: consumes the next argument unless it starts with `-` — commander's
 *   rule for `[value]` options (`-u`, `--update-snapshots [mode]`).
 * - `variadic`: consumes every following argument up to the next option — commander's
 *   rule for `<value...>` options, so `--project chromium cite/tests` names two projects.
 */
type Arity = 'required' | 'optional' | 'variadic';

const OPTION_ARITY = new Map<string, Arity>([
  ['--add-reporter', 'required'],
  ['--browser', 'required'],
  ['--config', 'required'], ['-c', 'required'],
  ['--debug', 'optional'],
  ['--global-timeout', 'required'],
  ['--grep', 'required'], ['-g', 'required'],
  ['--grep-invert', 'required'], ['-G', 'required'],
  ['--last-failed-file', 'required'],
  ['--max-failures', 'required'],
  ['--only-changed', 'optional'],
  ['--output', 'required'],
  ['--project', 'variadic'],
  ['--repeat-each', 'required'],
  ['--reporter', 'required'],
  ['--retries', 'required'],
  ['--run-agents', 'required'],
  ['--shard', 'required'],
  ['--test-list', 'required'],
  ['--test-list-invert', 'required'],
  ['--timeout', 'required'],
  ['--trace', 'required'],
  ['--tsconfig', 'required'],
  ['--ui-host', 'required'],
  ['--ui-port', 'required'],
  ['--update-snapshots', 'optional'], ['-u', 'optional'],
  ['--update-source-method', 'required'],
  ['--workers', 'required'], ['-j', 'required'],
]);

/**
 * Extract positional Playwright test path filters from a `playwright test` argument
 * list (defaults to the current invocation's). When no path filters are present,
 * Playwright is running the full configured suite.
 */
export function getPlaywrightPathFilters(args: string[] = process.argv.slice(2)): string[] {
  const filters: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (i === 0 && arg === 'test') {
      continue;
    }
    if (arg === '--') {
      filters.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      // `--grep=x` carries its value; so does a clustered short option (`-j4`, `-gfoo`).
      const inlineValue = arg.startsWith('--') ? arg.includes('=') : arg.length > 2;
      const arity = OPTION_ARITY.get(arg.startsWith('--') ? arg.split('=')[0] : arg.slice(0, 2));
      if (!arity || inlineValue) continue;
      if (arity === 'required') {
        i++;
      } else if (arity === 'optional') {
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) i++;
      } else {
        while (i + 1 < args.length && !args[i + 1].startsWith('-')) i++;
      }
      continue;
    }
    filters.push(arg);
  }

  return filters;
}

/** The repository's app directories: top-level directories with a `tests/` subdirectory. */
function knownAppDirs(): string[] {
  return fs.readdirSync(__dirname, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(__dirname, entry.name, 'tests')))
    .map(entry => entry.name.toLowerCase());
}

/** `filter` as a lower-case, forward-slash path relative to the repo root, without a leading `./` (a trailing `/` is kept: it is part of the regex). */
function normalizeFilter(filter: string): string {
  let normalized = filter.replace(/\\/g, '/');
  if (path.isAbsolute(filter)) {
    const root = __dirname.replace(/\\/g, '/');
    if (normalized.startsWith(`${root}/`)) normalized = normalized.slice(root.length + 1);
  }
  return normalized.replace(/^(\.\/)+/, '').toLowerCase();
}

/** Apps named in `CRUCIBLE_EXCLUDE_APPS` (comma-separated; `run-tests.sh --exclude`). */
export function excludedApps(value = process.env.CRUCIBLE_EXCLUDE_APPS ?? ''): string[] {
  return value.split(',').map(app => app.trim().toLowerCase()).filter(Boolean);
}

/**
 * Whether a run with these positional filters may include `app`'s tests.
 *
 * Playwright treats every positional filter as a case-insensitive regular expression
 * matched against each test file's full path — even one that names an existing
 * directory. So only a filter that is a path into an app's `tests/` directory
 * (`cite/tests`, `./cite/tests/home/x.spec.ts`, or the absolute equivalent) is confined
 * to that app. A bare `player` also matches every `playerVm/` path; `cite` and even
 * `cite/` match Blueprint's `.../admin-gallery-and-cite/...` specs, and `alloy/` matches
 * Caster's `integration-alloy/` specs. Such a filter (like a bare file name, a regex
 * fragment, or anything with `|`) may include every app. No filters at all is the full
 * suite.
 *
 * An app listed in `CRUCIBLE_EXCLUDE_APPS` is never included: `run-tests.sh --exclude`
 * drops its tests with `--grep-invert`, and this keeps setup and teardown from
 * provisioning or purging it.
 */
export function pathFiltersIncludeApp(
  app: string,
  filters = getPlaywrightPathFilters(),
  appDirs = knownAppDirs(),
  excluded = excludedApps(),
): boolean {
  const normalizedApp = app.toLowerCase();
  if (excluded.includes(normalizedApp)) {
    return false;
  }
  if (filters.length === 0) {
    return true;
  }

  return filters.some(filter => {
    const normalized = normalizeFilter(filter);
    const owner = normalized.includes('|')
      ? undefined
      : appDirs.find(dir => normalized === `${dir}/tests` || normalized.startsWith(`${dir}/tests/`));
    return owner === undefined || owner === normalizedApp;
  });
}
