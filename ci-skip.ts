// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * CI skip list filters for Playwright configuration.
 * Converts the skip list JSON into testIgnore and grepInvert filters.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Skip entry shape (matches the ci/skip-in-ci.json schema).
 */
export interface SkipEntry {
  file: string;
  title: string;
  requires: string;
  reason: string;
  added: string;
}

/**
 * Load the CI skip list from the environment-specified path or default.
 */
export function loadCiSkip(): SkipEntry[] {
  const listPath = process.env.CRUCIBLE_SKIP_LIST || resolve(__dirname, 'ci/skip-in-ci.json');
  try {
    const content = readFileSync(listPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to load skip list from ${listPath}: ${err}`);
  }
}

/**
 * Convert skip entries into Playwright config filters.
 * Returns { testIgnore, grepInvert } to merge into the config.
 */
export function ciSkipFilters(entries: SkipEntry[]): {
  testIgnore: string[];
  grepInvert: RegExp | undefined;
} {
  const testIgnore: string[] = [];
  const grepAlternatives: string[] = [];

  for (const entry of entries) {
    if (entry.title === '*') {
      // Whole-file skip: add to testIgnore
      testIgnore.push(entry.file);
    } else {
      // Single-test skip: build a grepInvert pattern
      // The grep target string is: file + " › " + joined title path
      // We need to match the exact test, anchored at the end
      const escapedFile = escapeRegex(entry.file);
      const titleSegments = entry.title.split(' › ').map(escapeRegex);
      // Join with a pattern that matches either ` › ` or ` ` (for titles containing ` › `)
      const titlePattern = titleSegments.join('(?: › | )');
      // Anchor at the end so we don't match extensions of this title
      grepAlternatives.push(`${escapedFile}.*${titlePattern}$`);
    }
  }

  const grepInvert = grepAlternatives.length > 0
    ? new RegExp(grepAlternatives.join('|'))
    : undefined;

  return { testIgnore, grepInvert };
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
