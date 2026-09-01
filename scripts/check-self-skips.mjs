// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Fail the build on conditional self-skips.
 *
 * `test.skip(!thing, 'no thing available')` inside a test body is the single
 * cheapest way to make this suite lie: the run is green, the report says
 * "skipped", and nobody notices that a whole scenario stopped being exercised
 * because a seeder broke or a service was down. Same for a bare `test.skip()` /
 * `test.fixme()`, which is non-coverage with no reason attached at all.
 *
 * Two things are still allowed, because both are visible in the test report and
 * both name themselves:
 *
 *   test.skip('Some scenario', async () => { ... })   // a skipped declaration
 *   test.skip(true, 'Pending upstream: <what is pending>')
 *
 * And where a conditional gate is genuinely right — an optional service the
 * deployment may not run — use `requirePrecondition(condition, reason)` from
 * `shared-fixtures.ts`, which skips locally and throws under CI.
 *
 * Escape hatch: put `// allow-self-skip: <why>` on the line before the call.
 * It is deliberately grep-able so a reviewer can find every one.
 *
 * Usage: node scripts/check-self-skips.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, not `.pathname`: the latter keeps URL percent-encoding, so a
// checkout under a path with a space in it fails the gate with an ENOENT on
// `/tmp/pr%20obe` rather than a skip verdict (and yields `/C:/...` on Windows).
const ROOT = fileURLToPath(new URL('..', import.meta.url));
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
const GUARDED_CALLS = ['test.skip', 'test.fixme'];
const ALLOW_MARKER = 'allow-self-skip';

/** All .ts files under `dir`, skipping generated and tooling directories. */
function collectTsFiles(dir, found = []) {
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
function startsRegexLiteral(blanked, at) {
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
function blankCommentsAndStrings(source) {
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

/** The call's first argument, as source text, or '' when it takes none. */
function firstArgument(code, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < code.length; i++) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return code.slice(openParenIndex + 1, i).trim();
    } else if (ch === ',' && depth === 1) {
      return code.slice(openParenIndex + 1, i).trim();
    }
  }
  return code.slice(openParenIndex + 1).trim();
}

function classify(argument) {
  if (argument === '') return 'bare';
  if (/^['"`]/.test(argument)) return 'declaration';
  if (argument === 'true' || argument === 'false') return 'literal';
  return 'conditional';
}

const violations = [];

for (const file of collectTsFiles(ROOT)) {
  const source = readFileSync(file, 'utf8');
  const code = blankCommentsAndStrings(source);

  for (const call of GUARDED_CALLS) {
    let from = 0;
    for (;;) {
      const at = code.indexOf(call, from);
      if (at === -1) break;
      from = at + call.length;

      // `test.skip` must be the whole member expression: don't match
      // `test.describe.skip` or a longer identifier that ends in these chars.
      const before = code[at - 1] ?? '';
      if (/[\w.$]/.test(before)) continue;

      const openParen = code.indexOf('(', at + call.length);
      if (openParen === -1 || code.slice(at + call.length, openParen).trim() !== '') continue;

      const kind = classify(firstArgument(code, openParen));
      if (kind === 'declaration' || kind === 'literal') continue;

      const line = source.slice(0, at).split('\n').length;
      const previousLine = source.split('\n')[line - 2] ?? '';
      if (previousLine.includes(ALLOW_MARKER)) continue;

      violations.push({
        file: relative(ROOT, file).split(sep).join('/'),
        line,
        kind,
        text: source.split('\n')[line - 1].trim(),
      });
    }
  }
}

if (violations.length === 0) {
  console.log('check-self-skips: no conditional or bare self-skips found.');
  process.exit(0);
}

console.error(`check-self-skips: found ${violations.length} self-skip(s) that would report green without asserting:\n`);
for (const v of violations) {
  const explanation =
    v.kind === 'bare'
      ? 'a bare skip with no condition and no reason'
      : 'a runtime condition decides whether this test asserts anything';
  console.error(`  ${v.file}:${v.line}  (${explanation})`);
  console.error(`    ${v.text}\n`);
}
console.error(
  'Fix by seeding the precondition (see player-helpers.ts / playerVm/vm-helpers.ts),\n' +
    'or, when the precondition is an optional service the test cannot create, use\n' +
    "requirePrecondition(condition, reason) from shared-fixtures.ts — it skips locally\n" +
    'and fails under CI. A deliberate, permanent skip should be a skipped declaration\n' +
    "(test.skip('title', fn)) or test.skip(true, 'Pending upstream: ...').\n" +
    `Last resort: a \`// ${ALLOW_MARKER}: <why>\` comment on the preceding line.`
);
process.exit(1);
