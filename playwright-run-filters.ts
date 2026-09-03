// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

const OPTIONS_WITH_VALUES = new Set([
  '--browser',
  '--config',
  '--global-timeout',
  '--grep',
  '--grep-invert',
  '--max-failures',
  '--output',
  '--project',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--shard',
  '--timeout',
  '--trace',
  '--update-snapshots',
  '--workers',
]);

/**
 * Extract positional Playwright test path filters from the current invocation.
 * When no path filters are present, Playwright is running the full configured suite.
 */
export function getPlaywrightPathFilters(): string[] {
  const args = process.argv.slice(2);
  const filters: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'test') {
      continue;
    }
    if (arg === '--') {
      filters.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const optionName = arg.split('=')[0];
      if (!arg.includes('=') && OPTIONS_WITH_VALUES.has(optionName)) {
        i++;
      }
      continue;
    }
    filters.push(arg);
  }

  return filters;
}

export function pathFiltersIncludeApp(app: string, filters = getPlaywrightPathFilters()): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedApp = app.toLowerCase();
  return filters.some(filter => {
    const normalizedFilter = filter.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
    return normalizedFilter === normalizedApp
      || normalizedFilter.endsWith(`/${normalizedApp}`)
      || normalizedFilter.includes(`/${normalizedApp}/`)
      || normalizedFilter.startsWith(`${normalizedApp}/`);
  });
}
