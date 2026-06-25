// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import fs from 'fs';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

/**
 * A minimal progress-bar reporter.
 *
 * Playwright knows the full test count up front (onBegin), so we can render an
 * accurate "% complete" bar and increment it as each test finishes (onTestEnd).
 *
 * The bar is written to /dev/tty rather than process.stdout on purpose:
 * run-tests.sh pipes all stdout/stderr through `tee` into a .log file, which
 * (a) makes process.stdout a non-TTY pipe so the redraw escape codes wouldn't
 * render, and (b) would dump every redraw frame into the log as noise. Writing
 * to the real terminal sidesteps both. When there is no controlling terminal
 * (CI, output redirected to a file with no `tee`), opening /dev/tty fails and
 * the reporter silently no-ops — so this never corrupts non-interactive logs.
 *
 * This is paired with the 'list'/'json' reporters in playwright.config.ts; those
 * own the scrollback and machine-readable output. This reporter only paints the
 * single pinned bar on the terminal and clears it when the run ends.
 */
class ProgressReporter implements Reporter {
  private total = 0;
  private completed = 0;
  private passed = 0;
  private failed = 0;
  private skipped = 0;

  // Write handle to the controlling terminal, or null when none is available.
  private tty: number | null = null;

  constructor() {
    try {
      // O_WRONLY. Throws (ENXIO/ENOENT) when there is no controlling tty.
      this.tty = fs.openSync('/dev/tty', 'w');
    } catch {
      this.tty = null;
    }
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length;
    this.render();
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
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
    this.render();
  }

  onEnd(result: FullResult): void {
    if (this.tty === null) return;
    // Clear the bar line so the trailing 'list' summary isn't drawn over it.
    this.write('\r\x1b[2K');
    fs.closeSync(this.tty);
    this.tty = null;
    void result;
  }

  /** Render (or re-render) the single-line progress bar in place. */
  private render(): void {
    if (this.tty === null || this.total === 0) return;

    const ratio = this.completed / this.total;
    const pct = Math.floor(ratio * 100);

    const width = 30;
    const filled = Math.round(ratio * width);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

    const counts =
      `${this.completed}/${this.total}` +
      (this.failed > 0 ? `  ✗ ${this.failed}` : '') +
      (this.skipped > 0 ? `  ⤼ ${this.skipped}` : '');

    // \r + clear-line, then repaint. No trailing newline so it stays pinned.
    this.write(`\r\x1b[2K[${bar}] ${String(pct).padStart(3)}%  ${counts}`);
  }

  private write(s: string): void {
    if (this.tty === null) return;
    try {
      fs.writeSync(this.tty, s);
    } catch {
      // Terminal went away mid-run; stop trying to paint to it.
      this.tty = null;
    }
  }
}

export default ProgressReporter;
