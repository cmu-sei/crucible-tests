// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  'playwright-report',
  'test-results',
  '.git',
  '.claude',
  '.codex',
  '.auth',
  '.logs',
]);

/** All .ts files under `dir`, skipping generated and tooling directories. */
export function collectTsFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsFiles(full, found);
    } else if (entry.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

/** Keywords after which a `/` begins a regex literal rather than a division. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'yield',
  'await',
  'case',
]);

/**
 * Whether the `/` at `at` opens a regex literal, judged from what precedes it in
 * `blanked` — the output array in progress, which already has earlier comments and
 * strings blanked, so scanning back over whitespace skips them too.
 *
 * A regex literal cannot follow a value, so the question is whether the last
 * significant character could have ended one. `)` is genuinely ambiguous
 * (`if (x) /re/.test(y)`) and is read as a value here, which is the common case.
 */
export function startsRegexLiteral(blanked, at) {
  let j = at - 1;
  while (j >= 0 && /\s/.test(blanked[j])) j--;
  if (j < 0) return true;

  const previous = blanked[j];
  if (/[\w$)\]'"`]/.test(previous)) {
    // Unless it closes a keyword: `return /re/` looks like `n /` from here.
    let start = j;
    while (start >= 0 && /[\w$]/.test(blanked[start])) start--;
    return REGEX_PRECEDING_KEYWORDS.has(blanked.slice(start + 1, j + 1).join(''));
  }

  return true;
}

/**
 * Replace comment, string-literal and regex-literal contents with spaces,
 * preserving every character offset so reported line numbers still match the real
 * file.
 *
 * Blanking is not cosmetic: this repo's specs discuss `test.skip()` in prose
 * constantly (the blueprint suite documents what each spec was rewritten *from*),
 * and a URL in a string literal contains `//`. A naive regex over raw text
 * either drowns in false positives or truncates lines at the wrong place.
 *
 * Regex literals have to be understood for the same reason, and the cost of not
 * doing it is worse than a false positive: quote characters inside a regex — as in
 * `playerVm/contract-sources.ts`, which matches on `['"`]` — otherwise open a
 * phantom string that blanks everything to the next matching quote, hundreds of
 * lines of it, and every self-skip in that range stops being seen. A gate that
 * silently stops checking is worse than no gate.
 *
 * `playerVm/contract-sources.ts` has a near-identical scanner (`mask`) for reading
 * the app clients. Keep the two in step; they are separate only because this file
 * has to run under plain `node`, with no TypeScript loader.
 */
export function blankCommentsAndStrings(source) {
  const out = source.split('');
  let i = 0;
  const blankTo = (end) => {
    for (; i < end && i < out.length; i++) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };

  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = source.length;
      blankTo(end);
      continue;
    }

    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      blankTo(end === -1 ? source.length : end + 2);
      continue;
    }

    const ch = source[i];

    if (ch === '/' && startsRegexLiteral(out, i)) {
      // Scan to the closing delimiter. A `/` inside a character class does not
      // close the literal, which is why the class is tracked.
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        else if (source[j] === '/' && !inClass) break;
        j++;
      }

      // An unterminated literal means this was a division after all; leave it be
      // rather than blanking the rest of the line on a guess.
      if (source[j] === '/') {
        i += 1;
        blankTo(j);
        i = j + 1;
        continue;
      }
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === ch) {
          j++;
          break;
        }
        j++;
      }
      // Keep the opening and closing quotes so a string literal argument is
      // still recognisable as one; blank only what is between them.
      i += 1;
      blankTo(j - 1);
      i = j;
      continue;
    }

    i++;
  }

  return out.join('');
}
