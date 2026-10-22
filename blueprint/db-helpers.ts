// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Direct Postgres access for MSEL state that only Blueprint's integration pipeline sets.
 *
 * Since blueprint.api #205 a MSEL's Pushing, Pulling and Deployed statuses, its integration IDs
 * (Player view, Gallery, CITE, Steamfitter, Caster) and its integration status are server-owned:
 * a create or edit that moves a MSEL into or out of a pipeline status is a 409, and the
 * integration fields are not on the create or edit requests at all. A real push reaches
 * Deployed, but it cannot hold a MSEL mid-push or in a failed push, and specs that only render
 * a deployed MSEL do not need the Player view a push creates. Those specs seed the state here.
 *
 * Specs that exercise the pipeline itself push for real (see caster-helpers.ts and
 * launch-and-join-workflows/launch-by-invitation-player-view.spec.ts).
 */

import { execSync } from 'child_process';
import { Client } from 'pg';

let postgresPassword: string | undefined;

function getPostgresPassword(): string {
  if (postgresPassword) {
    return postgresPassword;
  }

  if (process.env.CRUCIBLE_POSTGRES_PASSWORD) {
    postgresPassword = process.env.CRUCIBLE_POSTGRES_PASSWORD;
    return postgresPassword;
  }

  const output = execSync(
    `docker inspect crucible-postgres --format='{{range .Config.Env}}{{println .}}{{end}}'`,
    { encoding: 'utf8' }
  );
  const passwordLine = output.split('\n').find(line => line.startsWith('POSTGRES_PASSWORD='));
  if (!passwordLine) {
    throw new Error('POSTGRES_PASSWORD is not configured on the crucible-postgres container.');
  }

  postgresPassword = passwordLine.substring('POSTGRES_PASSWORD='.length);
  return postgresPassword;
}

let postgresPort: number | undefined;

/**
 * Resolves the host port Postgres is published on.
 *
 * Aspire assigns the host side of the mapping at startup, so it is not always 5432 and can
 * change between runs of the AppHost. `docker port` reports whatever it is now.
 */
function getPostgresPort(): number {
  if (postgresPort) {
    return postgresPort;
  }

  if (process.env.CRUCIBLE_POSTGRES_PORT) {
    postgresPort = Number(process.env.CRUCIBLE_POSTGRES_PORT);
    return postgresPort;
  }

  const output = execSync('docker port crucible-postgres 5432/tcp', { encoding: 'utf8' });
  // One line per published address, e.g. "127.0.0.1:5432".
  const match = output.split('\n').map(line => line.trim()).find(line => /:\d+$/.test(line));
  if (!match) {
    throw new Error(`Could not determine the published Postgres port from: ${output.trim()}`);
  }

  postgresPort = Number(match.slice(match.lastIndexOf(':') + 1));
  return postgresPort;
}

async function connectBlueprintDatabase(): Promise<Client> {
  const client = new Client({
    // 127.0.0.1 rather than localhost: the mapping is published on the IPv4 loopback only,
    // and localhost can resolve to ::1 first.
    host: process.env.CRUCIBLE_POSTGRES_HOST || '127.0.0.1',
    port: getPostgresPort(),
    user: 'postgres',
    password: getPostgresPassword(),
    database: process.env.BLUEPRINT_DB || 'blueprint',
  });
  await client.connect();
  return client;
}

/** `MselItemStatus` values as Blueprint stores them (Blueprint.Api.Data/Enumerations.cs). */
const MSEL_STATUS = {
  Pending: 0,
  Entered: 10,
  Approved: 20,
  Complete: 30,
  Pushing: 35,
  Pulling: 36,
  Deployed: 40,
  Archived: 50,
} as const;

export type MselStatus = keyof typeof MSEL_STATUS;

export interface MselIntegrationState {
  status?: MselStatus;
  /** Any GUID; Blueprint only checks it for non-null unless something calls Player with it. */
  playerViewId?: string | null;
  /** e.g. 'Pushing Integrations' or 'ERROR: ...'; null clears it. */
  integrationStatus?: string | null;
}

async function updateMselIntegrationState(
  mselId: string,
  state: MselIntegrationState
): Promise<number> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (state.status !== undefined) set('status', MSEL_STATUS[state.status]);
  if (state.playerViewId !== undefined) set('player_view_id', state.playerViewId);
  if (state.integrationStatus !== undefined) set('integration_status', state.integrationStatus);
  if (sets.length === 0) return 0;

  values.push(mselId);
  const client = await connectBlueprintDatabase();
  try {
    const result = await client.query(
      `UPDATE msels SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values
    );
    return result.rowCount ?? 0;
  } finally {
    await client.end();
  }
}

/**
 * Write a MSEL's pipeline-owned state directly, as a push or pull would have left it. Only the
 * fields given are changed. Blueprint reads the row fresh on every request, so the next page
 * load or API read sees it; a page already open is not told (no SignalR update is sent).
 */
export async function setMselIntegrationState(
  mselId: string,
  state: MselIntegrationState
): Promise<void> {
  if ((await updateMselIntegrationState(mselId, state)) !== 1) {
    throw new Error(`setMselIntegrationState: MSEL ${mselId} not found`);
  }
}

/**
 * Put a seeded MSEL back to an ordinary Approved MSEL with no integrations, so deleting it does
 * not queue a pull against a Player view the test created and is cleaning up itself. A MSEL that
 * is already gone is left alone, so this is safe in teardown.
 */
export async function clearMselIntegrationState(mselId: string): Promise<void> {
  await updateMselIntegrationState(mselId, {
    status: 'Approved',
    playerViewId: null,
    integrationStatus: null,
  });
}
