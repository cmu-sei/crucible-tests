// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * CI affected-runs planner: maps changed files to affected apps and specs.
 */

import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { collectTsFiles } from './source-scan.mjs';

const FULL_TRIGGERS = new Set([
  'ci-skip.ts',
  'shared-fixtures.ts',
  'auth-state.ts',
  'auth-paths.ts',
  'api-cache.ts',
  'provision-targets.ts',
  'load-env.ts',
  'playwright-run-filters.ts',
  'global-setup.ts',
  'global-teardown.ts',
  'playwright.config.ts',
  'progress-reporter.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'ci/slices.json',
]);

const FULL_TRIGGER_PREFIXES = ['.env', '.github/workflows/e2e', 'ci/stack/'];

const IGNORED_PATHS = new Set(['scripts', '.claude', 'node_modules', '.superpowers', 'docs', 'test-results', 'playwright-report']);

const APPS = ['alloy', 'blueprint', 'caster', 'cite', 'console', 'gallery', 'gameboard', 'player', 'playerVm', 'steamfitter', 'topomojo'];

/**
 * Build a transitive import graph: for each .ts file, which files import it.
 * The graph is keyed by repo-relative paths.
 *
 * @param {string} rootDir - Root directory to scan
 * @returns {Map<string, Set<string>>} Map from file path to set of importers
 */
export function buildImportGraph(rootDir) {
  const files = collectTsFiles(rootDir);
  const importMap = new Map(); // path -> Set of files it imports
  const graph = new Map(); // path -> Set of files that import it

  // First pass: build direct import relationships
  for (const absPath of files) {
    const relPath = relative(rootDir, absPath);
    if (IGNORED_PATHS.has(relPath.split('/')[0])) continue;

    const content = readFileSync(absPath, 'utf8');
    const imports = extractRelativeImports(content, relPath);

    if (!importMap.has(relPath)) importMap.set(relPath, new Set());
    for (const imported of imports) {
      importMap.get(relPath).add(imported);
    }
  }

  // Build reverse map (who imports each file)
  for (const [importer, imported] of importMap) {
    for (const target of imported) {
      if (!graph.has(target)) graph.set(target, new Set());
      graph.get(target).add(importer);
    }
  }

  // Build transitive closure
  const transitive = new Map();
  for (const file of graph.keys()) {
    transitive.set(file, computeTransitiveImporters(file, graph));
  }

  return transitive;
}

/**
 * Extract relative imports from TypeScript source.
 * Resolves './x' and '../x' imports, with or without '.ts' extension.
 * Handles `import`/`export ... from` statements that span several lines,
 * side-effect imports (`import './x'`) and dynamic imports (`import('./x')`).
 *
 * @param {string} content - TypeScript source
 * @param {string} fromPath - Repo-relative path of the importing file
 * @returns {Set<string>} Repo-relative paths of the imported files
 */
export function extractRelativeImports(content, fromPath) {
  const imports = new Set();
  const dir = fromPath.split('/').slice(0, -1).join('/');

  // [^;]*? crosses newlines, so a named-import list split over several lines still
  // reaches its `from` clause; stopping at `;` keeps it inside one statement.
  const patterns = [
    /^\s*(?:import|export)\b[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/gm,
    /^\s*import\s*['"](\.[^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];
  const specifiers = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) specifiers.push(match[1]);
  }

  for (const importPath of specifiers) {
    let resolved = importPath;

    // Resolve relative to current file's directory
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const parts = dir ? dir.split('/') : [];
      const importParts = importPath.split('/');

      for (const part of importParts) {
        if (part === '.') continue;
        if (part === '..') {
          parts.pop();
        } else {
          parts.push(part);
        }
      }
      resolved = parts.join('/');
    }

    // Add .ts if not present
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      resolved += '.ts';
    }

    imports.add(resolved);
  }

  return imports;
}

/**
 * Compute transitive closure: all files that directly or transitively import `file`.
 */
function computeTransitiveImporters(file, directGraph) {
  const result = new Set();
  const visited = new Set();
  const queue = [file];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const directImporters = directGraph.get(current);
    if (directImporters) {
      for (const importer of directImporters) {
        result.add(importer);
        queue.push(importer);
      }
    }
  }

  return result;
}

/**
 * Determine affected runs from changed files.
 *
 * @param {Array<{path: string, status: 'A'|'M'|'D'|'R'}>} changed - Changed files
 * @param {Map<string, Set<string>>} graph - Import graph
 * @param {{listChangedFiles: string[], skip: SkipEntry[]}} lists - CI lists
 * @returns {{full: boolean, runs: {app: string, specs: string[]}[], dropped: {spec: string, requires: string}[]}}
 */
export function affectedRuns(changed, graph, lists) {
  const result = {
    full: false,
    runs: [],
    dropped: [],
  };

  // Track which apps need to run and which specs
  const affectedApps = new Map(); // app -> Set of specs (empty = whole app)

  for (const { path, status } of changed) {
    // Rule 1: Full triggers
    if (FULL_TRIGGERS.has(path) || FULL_TRIGGER_PREFIXES.some(prefix => path.startsWith(prefix))) {
      result.full = true;
      return result;
    }

    // Rule 2: Spec files. A deleted spec has nothing left to run; any other
    // deleted file under <app>/ falls through to rule 3, since its importers
    // may now break.
    if (path.match(/^([^/]+)\/tests\/.*\.spec\.ts$/)) {
      if (status === 'D') continue;
      const app = path.split('/')[0];
      if (APPS.includes(app)) {
        if (!affectedApps.has(app)) affectedApps.set(app, new Set());
        // Only add spec if not already whole-app
        if (affectedApps.get(app) !== null) {
          affectedApps.get(app).add(path);
        }
      }
      continue;
    }

    // Rule 3: Other files under <app>/
    const appMatch = path.match(/^([^/]+)\//);
    if (appMatch && APPS.includes(appMatch[1])) {
      const app = appMatch[1];
      affectedApps.set(app, null); // null = whole app

      // Also trigger whole app for any other app that imports this file
      const importers = graph.get(path) || new Set();
      for (const importer of importers) {
        const importerApp = importer.split('/')[0];
        if (APPS.includes(importerApp)) {
          affectedApps.set(importerApp, null);
        }
      }
      continue;
    }

    // Rule 4: Root .ts files
    if (path.endsWith('.ts') && !path.includes('/')) {
      const importers = graph.get(path) || new Set();
      for (const importer of importers) {
        const importerApp = importer.split('/')[0];
        if (APPS.includes(importerApp)) {
          affectedApps.set(importerApp, null);
        }
      }
      continue;
    }

    // Rule 5: List changes
    if (path === 'ci/known-failures.json' || path === 'ci/skip-in-ci.json') {
      for (const specPath of lists.listChangedFiles) {
        const app = specPath.split('/')[0];
        if (APPS.includes(app)) {
          if (!affectedApps.has(app)) affectedApps.set(app, new Set());
          if (affectedApps.get(app) !== null) {
            affectedApps.get(app).add(specPath);
          }
        }
      }
      continue;
    }

    // Rule 7: Everything else triggers nothing (already handled by continuing above)
  }

  // Convert affectedApps to runs array
  for (const [app, specs] of affectedApps) {
    if (specs === null) {
      result.runs.push({ app, specs: [] });
    } else {
      result.runs.push({ app, specs: Array.from(specs).sort() });
    }
  }

  // Rule 6: Apply skip filter
  const skipMap = new Map(); // file -> Set of titles
  for (const entry of lists.skip) {
    if (!skipMap.has(entry.file)) skipMap.set(entry.file, new Set());
    skipMap.get(entry.file).add(entry.title);
  }

  const filteredRuns = [];
  for (const run of result.runs) {
    if (run.specs.length === 0) {
      // Whole-app run: keep it
      filteredRuns.push(run);
    } else {
      // Filter specs
      const filteredSpecs = [];
      for (const spec of run.specs) {
        const skipTitles = skipMap.get(spec);
        if (skipTitles && skipTitles.has('*')) {
          // Whole file is skipped
          const requires = lists.skip.find(e => e.file === spec && e.title === '*')?.requires;
          result.dropped.push({ spec, requires });
        } else {
          filteredSpecs.push(spec);
        }
      }

      if (filteredSpecs.length > 0) {
        filteredRuns.push({ app: run.app, specs: filteredSpecs });
      }
      // If no specs left, drop the run entirely
    }
  }

  result.runs = filteredRuns;
  return result;
}

/**
 * Parse and validate --apps filter.
 * Returns { ok: true, apps: string[] } or { ok: false, error: string }.
 */
export function parseAppsFilter(appsArg, fullMode, validApps) {
  if (appsArg && !fullMode) {
    return { ok: false, error: '--apps can only be used with --full' };
  }

  if (!appsArg) {
    return { ok: true, apps: null };
  }

  const apps = appsArg.split(',').map(a => a.trim()).filter(Boolean);
  for (const app of apps) {
    if (!validApps.includes(app)) {
      return {
        ok: false,
        error: `Unknown app name: ${app}\nValid apps: ${validApps.join(', ')}`,
      };
    }
  }

  return { ok: true, apps };
}

/**
 * Convert affected runs to GitHub Actions matrix format.
 */
export function toMatrix(result) {
  const include = [];

  // A full run with no explicit runs (affectedRuns hit a full trigger) means
  // every app. A full run with runs (the CLI's --full [--apps]) uses them as is.
  const runs = result.full && result.runs.length === 0
    ? APPS.map(app => ({ app, specs: [] }))
    : result.runs;
  for (const run of runs) {
    const specs = run.specs.length === 0 ? `${run.app}/tests/` : run.specs.join(' ');
    include.push({ app: run.app, specs });
  }

  return { include };
}
