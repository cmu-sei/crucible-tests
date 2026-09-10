// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Runs Moodle's own CLI scripts inside the Moodle container.
 *
 * Some plugin behaviour only happens on a scheduled or adhoc task, and the UI
 * gives no way to trigger one. Waiting for the cron interval would make a test
 * both slow and flaky, so tests drive the task directly and then assert on the
 * result.
 */

import { execFileSync } from 'child_process';

const moodleContainer = process.env.MOODLE_CONTAINER || 'moodle';
const moodleRoot = process.env.MOODLE_CONTAINER_ROOT || '/var/www/html';

/**
 * Executes `php <script> <args>` from the Moodle web root and returns combined
 * output. Throws with the captured output on a non-zero exit so a failing task
 * reports why rather than just "command failed".
 */
export function runMoodleCli(script: string, args: string[] = [], timeoutMs: number = 300_000): string {
  try {
    return execFileSync(
      'docker',
      ['exec', '--workdir', moodleRoot, moodleContainer, 'php', script, ...args],
      { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (error: any) {
    const output = [error?.stdout, error?.stderr].filter(Boolean).join('\n');
    throw new Error(`moodle cli \`php ${script} ${args.join(' ')}\` failed: ${output || error?.message}`);
  }
}

/**
 * Runs every queued adhoc task of one class to completion.
 *
 * `--ignorelimits` bypasses the concurrency ceiling and `--force` runs even when
 * cron is disabled, so the outcome does not depend on how the environment has
 * cron configured. The class name needs a leading backslash and is passed as a
 * single argv entry, so no shell escaping is involved.
 */
export function runMoodleAdhocTask(classname: string, timeoutMs: number = 600_000): string {
  return runMoodleCli(
    'admin/cli/adhoc_task.php',
    ['--execute', '--ignorelimits', '--force', `--classname=${classname}`],
    timeoutMs
  );
}

/** Runs one scheduled task to completion, e.g. `\mod_topomojo\task\close_attempts`. */
export function runMoodleScheduledTask(classname: string, timeoutMs: number = 600_000): string {
  return runMoodleCli('admin/cli/scheduled_task.php', [`--execute=${classname}`, '--force'], timeoutMs);
}

/**
 * Runs a PHP snippet with Moodle bootstrapped, and returns whatever it echoed.
 *
 * The snippet is passed as a single argv entry, so there is no shell quoting to
 * get wrong. Reserved for setup a test genuinely cannot reach through the UI or
 * an existing CLI script.
 */
export function runMoodlePhp(snippet: string, timeoutMs: number = 120_000): string {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '--workdir',
        moodleRoot,
        moodleContainer,
        'php',
        '-r',
        `define('CLI_SCRIPT', true); require('${moodleRoot}/config.php'); ${snippet}`,
      ],
      { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
  } catch (error: any) {
    const output = [error?.stdout, error?.stderr].filter(Boolean).join('\n');
    throw new Error(`moodle php snippet failed: ${output || error?.message}`);
  }
}

/**
 * Queues a bulk deploy exactly the way `manage_action.php`'s `deploy_selected`
 * branch does — a job row per user plus an adhoc task set to run immediately —
 * and returns the job id.
 *
 * The management page is the user-facing way in and is covered by its own test.
 * This exists for tests that assert on the *result* of a deploy from a session
 * that is not an instructor's: the admin UI and a student page cannot share one
 * browser context, and re-authenticating the same context would silently keep
 * whichever session logged in first.
 */
export function queueMoodleTopomojoBulkDeploy(
  cmid: string | number,
  userIds: number[],
  batchsize: number = 10
): number {
  const idList = userIds.map(id => Number(id)).join(',');
  const jobid = runMoodlePhp(
    `$cm = get_coursemodule_from_id('topomojo', ${Number(cmid)}, 0, false, MUST_EXIST);`
    + ` $t = $DB->get_record('topomojo', ['id' => $cm->instance], '*', MUST_EXIST);`
    + ` $repo = new \\mod_topomojo\\local\\bulkdeploy\\job_repository();`
    + ` $jobid = $repo->create_job((int) $t->id, (int) $cm->course, (int) get_admin()->id,`
    + ` ${Number(batchsize)}, null, [${idList}], null);`
    + ` $task = new \\mod_topomojo\\task\\bulkdeploy_run();`
    + ` $task->set_custom_data((object) ['jobid' => $jobid]);`
    + ` $task->set_component('mod_topomojo');`
    // No set_next_run_time(): the cron runner selects on `nextruntime < now`, so a
    // task scheduled for exactly now is invisible to a runner that starts in the
    // same second — which is what happens here, since the run follows the queue
    // immediately. Leaving it unset makes queue_adhoc_task() schedule it at
    // `time() - 1`, which is core's own way of saying "immediately".
    + ` \\core\\task\\manager::queue_adhoc_task($task);`
    + ` echo $jobid;`
  );
  const parsed = Number(jobid);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a bulk-deploy job id, got: ${jobid}`);
  }
  return parsed;
}
