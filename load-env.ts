// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Load Crucible test environment variables.
 *
 * Selection order:
 *   1. If CRUCIBLE_TARGET is set, load `.env.<target>` (e.g. `.env.minikube`).
 *      This selects between the Aspire (localhost ports) and Minikube
 *      (single-host ingress) topologies.
 *   2. Otherwise, load `.env` for back-compat with existing setups.
 *   3. `.env.local` is loaded last (if present) so users can override individual
 *      values without editing the tracked profile files.
 *
 * dotenv does not overwrite already-set process env vars, so values exported
 * by the shell (e.g. by run-tests.sh) take precedence over the file contents.
 */
export function loadCrucibleEnv(): void {
  const root = __dirname;
  const target = (process.env.CRUCIBLE_TARGET || '').trim().toLowerCase();

  const candidates: string[] = [];

  if (target) {
    const targetFile = path.resolve(root, `.env.${target}`);
    if (!fs.existsSync(targetFile)) {
      throw new Error(
        `CRUCIBLE_TARGET=${target} but ${targetFile} does not exist. ` +
        `Expected one of: aspire, minikube (or create .env.${target}).`
      );
    }
    candidates.push(targetFile);
  } else {
    candidates.push(path.resolve(root, '.env'));
  }

  // Optional per-user overrides, always loaded last.
  candidates.push(path.resolve(root, '.env.local'));

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
    }
  }
}
