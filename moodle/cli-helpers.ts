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

/**
 * Purges every Moodle cache.
 *
 * Needed after writing to a table Moodle caches, which question definitions are:
 * an UPDATE on mdl_question_answers is invisible to a page request until the
 * question bank's cached copy is dropped.
 */
export function purgeMoodleCaches(timeoutMs: number = 300_000): string {
  return runMoodleCli('admin/cli/purge_caches.php', [], timeoutMs);
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

/**
 * Queues a Crucible bulk deploy the way `manage_deployments_action.php` does — a
 * job row per user plus an adhoc task — and returns the job id.
 *
 * The launcher starts each event through the plugin's system OAuth client and
 * hands Alloy the user's `idnumber` as their Alloy GUID, so a DB-seeded user
 * gets a real event without ever logging in.
 */
export function queueMoodleCrucibleBulkDeploy(cmid: string | number, userIds: number[]): number {
  const idList = userIds.map(id => Number(id)).join(',');
  const jobid = runMoodlePhp(
    `$cm = get_coursemodule_from_id('crucible', ${Number(cmid)}, 0, false, MUST_EXIST);`
    + ` $c = $DB->get_record('crucible', ['id' => $cm->instance], '*', MUST_EXIST);`
    + ` $repo = new \\mod_crucible\\local\\bulkdeploy\\job_repository();`
    // Crucible processes one user at a time, so the batch size is always 1.
    + ` $jobid = $repo->create_job((int) $c->id, (int) $cm->course, (int) get_admin()->id, 1, null, [${idList}]);`
    + ` $task = new \\mod_crucible\\task\\bulkdeploy_run();`
    + ` $task->set_custom_data((object) ['jobid' => $jobid]);`
    + ` $task->set_component('mod_crucible');`
    // Left unscheduled for the same reason as queueMoodleTopomojoBulkDeploy().
    + ` \\core\\task\\manager::queue_adhoc_task($task);`
    + ` echo $jobid;`
  );
  const parsed = Number(jobid);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a bulk-deploy job id, got: ${jobid}`);
  }
  return parsed;
}

/**
 * Deletes a user's personal data the way a privacy officer does: a "Delete all
 * of my personal data" request is created and approved as the site admin, then
 * tool_dataprivacy's own adhoc tasks pre-process and carry it out. Processing
 * calls every plugin's privacy provider and finally deletes the user account,
 * so only ever pass a disposable user.
 *
 * Returns the request's final status number. A delete request that ran ends at
 * 10 (DATAREQUEST_STATUS_DELETED), not 5 (COMPLETE).
 */
export async function deleteMoodleUserDataViaPrivacyRequest(userId: number, timeoutMs: number = 120_000): Promise<number> {
  const asAdmin = `\\core\\session\\manager::set_user(get_admin());`;
  const requestid = Number(runMoodlePhp(
    asAdmin
    + ` $r = \\tool_dataprivacy\\api::create_data_request(${Number(userId)},`
    + ` \\tool_dataprivacy\\api::DATAREQUEST_TYPE_DELETE, 'e2e privacy deletion', `
    + ` \\tool_dataprivacy\\data_request::DATAREQUEST_CREATION_MANUAL, false);`
    + ` echo $r->get('id');`
  ));
  if (!Number.isInteger(requestid) || requestid <= 0) {
    throw new Error(`Expected a data request id for user ${userId}, got: ${requestid}`);
  }

  // Pre-processing moves the request to "Awaiting approval".
  runMoodleAdhocTask('\\tool_dataprivacy\\task\\initiate_data_request_task');
  runMoodlePhp(`${asAdmin} \\tool_dataprivacy\\api::approve_data_request(${requestid});`);

  // The container's own cron can claim the queued task first, in which case this
  // run finds nothing to do and the request is still mid-processing - so poll for
  // a status past "Approved" (3) and "Processing" (4) rather than read it once.
  const readStatus = () => Number(runMoodlePhp(
    `echo $DB->get_field('tool_dataprivacy_request', 'status', ['id' => ${requestid}], MUST_EXIST);`
  ));
  const deadline = Date.now() + timeoutMs;
  let status = readStatus();
  while ([3, 4].includes(status) && Date.now() < deadline) {
    runMoodleAdhocTask('\\tool_dataprivacy\\task\\process_data_request_task');
    status = readStatus();
    if ([3, 4].includes(status)) {
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  return status;
}
