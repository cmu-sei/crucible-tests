// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import fs from 'fs';
import tty from 'tty';
import path from 'path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

/**
 * Progress-bar reporter that pins a live "% complete" bar to the bottom row of
 * the terminal while per-test output scrolls above it.
 *
 * This replaces Playwright's built-in 'list' reporter (do not enable both — they
 * would each write the same per-test lines and fight over the cursor). It owns
 * the terminal output for the test phase and writes to two places:
 *
 *   - the controlling terminal (/dev/tty): colored test lines + the pinned bar
 *   - the run log file (CRUCIBLE_LOG_FILE, set by run-tests.sh): the same lines
 *     as plain text with no escape codes, so the log stays clean and greppable
 *
 * Pinning uses a DECSTBM scroll region (ESC[1;<rows-1>r): the bottom row is
 * reserved for the bar and all test output scrolls within the region above it.
 * We write to /dev/tty directly rather than stdout because run-tests.sh pipes
 * stdout through `tee`, which is not a TTY (so we couldn't size the terminal or
 * trust the escapes) and would also capture every redraw frame as log noise.
 *
 * Graceful degradation: when there is no controlling terminal (CI, redirected
 * output) the reporter falls back to writing plain per-test lines to
 * process.stdout — i.e. the same behavior as the 'list' reporter — so nothing
 * breaks and non-interactive logs stay clean.
 */

const ESC = '\x1b';
const CSI = `${ESC}[`;

const COLORS = {
  green: `${CSI}32m`,
  red: `${CSI}31m`,
  yellow: `${CSI}33m`,
  dim: `${CSI}2m`,
  reset: `${CSI}0m`,
};

class ProgressReporter implements Reporter {
  private total = 0;
  private completed = 0;
  private passed = 0;
  private failed = 0;
  private skipped = 0;

  // Terminal stream for the controlling tty, or null when none is available
  // (the "plain" fallback mode).
  private stream: tty.WriteStream | null = null;
  // Append-only handle to the run log file, or null when CRUCIBLE_LOG_FILE is
  // unset (e.g. plain fallback mode, where stdout+tee already capture the log).
  private logFd: number | null = null;

  private rows = 24;
  private columns = 80;

  // When false, test stdout/stderr goes only to the log, not the live terminal,
  // to keep the scrolling output readable. Set via CRUCIBLE_VERBOSE (the
  // --verbose flag on run-tests.sh). Always true in plain fallback mode, where
  // there is no separate log and stdout is the only sink.
  private verbose = process.env.CRUCIBLE_VERBOSE === '1';

  private onResize = (): void => {
    if (!this.stream) return;
    this.rows = this.stream.rows || this.rows;
    this.columns = this.stream.columns || this.columns;
    this.setScrollRegion();
    this.drawBar();
  };

  constructor() {
    try {
      const fd = fs.openSync('/dev/tty', 'w');
      const stream = new tty.WriteStream(fd);
      if (!stream.isTTY) throw new Error('not a tty');
      this.stream = stream;
      this.rows = stream.rows || 24;
      this.columns = stream.columns || 80;
    } catch {
      this.stream = null; // plain fallback
    }

    const logFile = process.env.CRUCIBLE_LOG_FILE;
    if (this.stream && logFile) {
      try {
        this.logFd = fs.openSync(logFile, 'a');
      } catch {
        this.logFd = null;
      }
    }
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length;
    if (!this.stream) return;

    process.on('SIGWINCH', this.onResize);
    // Reserve the bottom row, then park the cursor at the bottom of the scroll
    // region so test output flows in from the bottom like a normal terminal.
    this.setScrollRegion();
    this.tw(`${CSI}${this.rows - 1};1H`);
    this.drawBar();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // onTestEnd fires once per attempt, including retries. Only count a test
    // toward progress on its final attempt — otherwise `completed` overshoots
    // `total` (which counts unique tests), driving the bar width negative.
    const willRetry =
      result.status !== 'passed' &&
      result.status !== 'skipped' &&
      result.retry < test.retries;

    if (!willRetry) {
      this.completed++;
      switch (result.status) {
        case 'passed':
          this.passed++;
          break;
        case 'skipped':
          this.skipped++;
          break;
        default:
          this.failed++;
          break;
      }
    }
    this.emitLine(test, result);
  }

  // Test console.log / stdout. Without these hooks Playwright's captured test
  // output goes nowhere (the built-in 'list' reporter is what normally prints
  // it), so debug output would be silently swallowed.
  onStdOut(chunk: string | Buffer): void {
    this.emitRaw(chunk, false);
  }

  onStdErr(chunk: string | Buffer): void {
    this.emitRaw(chunk, true);
  }

  onEnd(result: FullResult): void {
    if (!this.stream) {
      // Plain fallback: stdout (captured by tee) gets the summary too.
      process.stdout.write(`${this.stripAnsi(this.summaryText(result.status))}\n`);
      return;
    }

    process.removeListener('SIGWINCH', this.onResize);

    // Release the scroll region and clear the reserved bar row, then drop a
    // final summary just below the last test line so the shell's trailing
    // "Done!" prints cleanly after it.
    this.tw(`${CSI}r`); // reset scroll region to full screen
    this.tw(`${CSI}${this.rows};1H${CSI}2K`); // clear the old bar row

    const summary = this.summaryText(result.status);
    this.tw(`${summary}\n`);
    this.logWrite(`${this.stripAnsi(summary)}\n`);

    if (this.logFd !== null) {
      try {
        fs.closeSync(this.logFd);
      } catch {
        /* ignore */
      }
      this.logFd = null;
    }
  }

  /** Write one finished-test line: colored to the tty, plain to the log. */
  private emitLine(test: TestCase, result: TestResult): void {
    const { colored, plain } = this.formatLine(test, result);

    if (!this.stream) {
      // Plain fallback: stdout (captured by tee) owns both screen and log.
      process.stdout.write(`${plain}\n`);
      return;
    }

    // Move to the bottom row of the scroll region, clear it, print the line.
    // The trailing newline at the bottom margin scrolls the region (not the
    // reserved bar row) up by one.
    this.tw(`${CSI}${this.rows - 1};1H${CSI}2K${colored}\n`);
    this.logWrite(`${plain}\n`);
    this.drawBar();
  }

  /**
   * Route raw test stdout/stderr to the log, and to the terminal only in verbose
   * mode. The log always gets a full copy so debug output is never lost; the live
   * terminal stays uncluttered unless --verbose (CRUCIBLE_VERBOSE) is set.
   */
  private emitRaw(chunk: string | Buffer, isErr: boolean): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

    if (!this.stream) {
      // Plain fallback: stdout/stderr is the only sink (tee captures it), so it
      // must always pass through regardless of verbosity.
      (isErr ? process.stderr : process.stdout).write(text);
      return;
    }

    // Always record to the log.
    this.logWrite(this.stripAnsi(text));

    if (!this.verbose) return;

    // Verbose: also show on the terminal. Position at the bottom of the scroll
    // region and clear that row first; embedded newlines scroll the region (not
    // the reserved bar row).
    this.tw(`${CSI}${this.rows - 1};1H${CSI}2K`);
    this.tw(text);
    this.drawBar();
  }

  private formatLine(
    test: TestCase,
    result: TestResult
  ): { colored: string; plain: string } {
    let symbol = '✓';
    let color = COLORS.green;
    if (result.status === 'skipped') {
      symbol = '-';
      color = COLORS.yellow;
    } else if (result.status !== 'passed') {
      symbol = '✗';
      color = COLORS.red;
    }

    const project = test.parent.project()?.name;
    const file = path.relative(process.cwd(), test.location.file);
    const where = `${file}:${test.location.line}`;
    const dur = `${Math.round(result.duration)}ms`;
    const prefix = project ? `[${project}] ` : '';

    const titleLine = `${symbol} ${prefix}${test.title}`;
    const meta = `${where} (${dur})`;

    // Truncate to terminal width so a long line can't wrap into the bar row.
    const plainFull = `  ${titleLine}  ${meta}`;
    const plain = this.truncate(plainFull, this.columns - 1);
    const colored = this.truncate(
      `  ${color}${symbol}${COLORS.reset} ${prefix}${test.title}  ${COLORS.dim}${meta}${COLORS.reset}`,
      this.columns - 1,
      // visible length budget ignores the escape codes we just added
      plainFull.length
    );

    return { colored, plain };
  }

  /** Render (or re-render) the pinned bar on the reserved bottom row. */
  private drawBar(): void {
    if (!this.stream || this.total === 0) return;

    const ratio = Math.max(0, Math.min(1, this.completed / this.total));
    const pct = Math.floor(ratio * 100);
    const width = 30;
    const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

    const counts =
      `${this.completed}/${this.total}` +
      (this.failed > 0 ? `  ${COLORS.red}✗ ${this.failed}${COLORS.reset}` : '') +
      (this.skipped > 0
        ? `  ${COLORS.yellow}⤼ ${this.skipped}${COLORS.reset}`
        : '');

    // Jump to the reserved row, clear it, paint. No newline (it must not scroll).
    this.tw(
      `${CSI}${this.rows};1H${CSI}2K[${bar}] ${String(pct).padStart(3)}%  ${counts}`
    );
  }

  private summaryText(status: FullResult['status']): string {
    const parts = [`${this.passed} passed`];
    if (this.failed > 0) parts.push(`${this.failed} failed`);
    if (this.skipped > 0) parts.push(`${this.skipped} skipped`);
    const color =
      status === 'passed' ? COLORS.green : this.failed > 0 ? COLORS.red : COLORS.yellow;
    return `${color}Ran ${this.total} tests: ${parts.join(', ')}${COLORS.reset}`;
  }

  private setScrollRegion(): void {
    // Reserve the last row; the region above it (rows 1..rows-1) scrolls.
    this.tw(`${CSI}1;${this.rows - 1}r`);
  }

  /** Truncate a (possibly ANSI-decorated) string to a visible-length budget. */
  private truncate(s: string, max: number, visibleLen?: number): string {
    const len = visibleLen ?? s.length;
    if (len <= max) return s;
    // For colored strings we can't safely cut mid-escape, so the caller passes
    // the plain length; fall back to a hard slice only for plain text.
    if (visibleLen === undefined) return `${s.slice(0, max - 1)}…`;
    return s; // colored variant: leave as-is, the plain log line is truncated
  }

  private stripAnsi(s: string): string {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private tw(s: string): void {
    if (!this.stream) return;
    try {
      this.stream.write(s);
    } catch {
      this.stream = null; // terminal went away; stop painting
    }
  }

  private logWrite(s: string): void {
    if (this.logFd === null) return;
    try {
      fs.writeSync(this.logFd, s);
    } catch {
      /* ignore log write failures */
    }
  }
}

export default ProgressReporter;
