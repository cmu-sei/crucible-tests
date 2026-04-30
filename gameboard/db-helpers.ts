// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Direct Postgres access helpers for seeding scoreboard data.
 *
 * A few Gameboard features (leaderboard pagination, scoreboard search,
 * score timelines) only surface when the database already has populated
 * Player rows with Score, Rank, and CorrectCount values. The REST API does
 * not let us set these fields directly — they are updated by the scoring
 * pipeline in response to challenge submissions.
 *
 * For tests, we insert Player rows directly via SQL. Connection details come
 * from the running postgres container (via `docker inspect`). Tests that use
 * these helpers remain self-contained by tagging seeded rows with a unique
 * prefix so cleanup is unambiguous.
 */

import { Client } from 'pg';
import { execSync } from 'child_process';

let _password: string | null = null;

function getPostgresPassword(): string {
  if (_password) return _password;

  // Allow explicit override via env var (CI or custom setups).
  if (process.env.CRUCIBLE_POSTGRES_PASSWORD) {
    _password = process.env.CRUCIBLE_POSTGRES_PASSWORD;
    return _password;
  }

  try {
    const out = execSync(
      `docker inspect crucible-postgres --format='{{range .Config.Env}}{{.}}{{"\\n"}}{{end}}'`,
      { encoding: 'utf8' }
    );
    const line = out.split('\n').find(l => l.startsWith('POSTGRES_PASSWORD='));
    if (!line) throw new Error('POSTGRES_PASSWORD not set on container');
    _password = line.substring('POSTGRES_PASSWORD='.length);
    return _password;
  } catch (err) {
    throw new Error(
      `Could not determine Postgres password. Either set CRUCIBLE_POSTGRES_PASSWORD ` +
      `or run the crucible-postgres container (docker inspect failed: ${(err as Error).message}).`
    );
  }
}

export async function gbConnect(): Promise<Client> {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: getPostgresPassword(),
    database: 'gameboard',
  });
  await client.connect();
  return client;
}

/**
 * Short uuid-like id (32 lowercase hex chars, matching Gameboard conventions).
 */
export function generateEntityId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface SeedPlayerOptions {
  gameId: string;
  sponsorId: string;
  score: number;
  rank: number;
  correctCount?: number;
  partialCount?: number;
  time?: number;
  /** Display name; defaults to "Seeded <random>". */
  approvedName?: string;
  /** Role: 0 = Member, 1 = Manager. Default 1 (captain of a single-player team). */
  role?: 0 | 1;
  /** Player mode: 0 = Competition, 1 = Practice. Default 0. */
  mode?: 0 | 1;
}

/**
 * Insert a Player row directly. Each seeded player is assigned their own
 * TeamId (mimicking single-player competition enrollment). Also creates a
 * synthetic User row so foreign keys resolve. Returns the player id.
 *
 * Seeded rows have `Name` starting with `__seed__` so tests can bulk-delete
 * their artifacts.
 */
export async function seedScoreboardPlayer(
  client: Client,
  opts: SeedPlayerOptions
): Promise<{ playerId: string; userId: string; teamId: string; approvedName: string }> {
  const userId = generateEntityId();
  const playerId = generateEntityId();
  const teamId = generateEntityId();
  const approvedName = opts.approvedName ?? `Seeded ${playerId.substring(0, 6)}`;

  // Insert user first (Players.UserId has FK to Users.Id)
  await client.query(
    `INSERT INTO "Users" ("Id", "Username", "ApprovedName", "Name", "SponsorId", "HasDefaultSponsor", "CreatedOn", "Role", "LoginCount")
     VALUES ($1, $2, $3, $4, $5, false, now(), 0, 0)
     ON CONFLICT ("Id") DO NOTHING`,
    [userId, `__seed__${userId.substring(0, 10)}`, approvedName, approvedName, opts.sponsorId]
  );

  await client.query(
    `INSERT INTO "Players" (
       "Id", "TeamId", "UserId", "GameId", "ApprovedName", "Name",
       "Role", "SessionBegin", "SessionEnd", "SessionMinutes",
       "Rank", "Score", "Time", "CorrectCount", "PartialCount",
       "Advanced", "Mode", "IsReady", "WhenCreated", "SponsorId", "IsLateStart"
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, now(), now() + interval '60 minutes', 60,
       $8, $9, $10, $11, $12,
       false, $13, false, now(), $14, false
     )`,
    [
      playerId,
      teamId,
      userId,
      opts.gameId,
      approvedName,
      `__seed__${approvedName}`,
      opts.role ?? 1,
      opts.rank,
      opts.score,
      opts.time ?? 0,
      opts.correctCount ?? 0,
      opts.partialCount ?? 0,
      opts.mode ?? 0,
      opts.sponsorId,
    ]
  );

  return { playerId, userId, teamId, approvedName };
}

/**
 * Delete all scoreboard rows seeded for the given game. Removes Players and
 * their synthetic Users in one pass (cascades kick in for any challenge rows).
 */
export async function cleanupSeededScoreboard(
  client: Client,
  gameId: string
): Promise<number> {
  const seeded = await client.query<{ Id: string; UserId: string }>(
    `SELECT "Id", "UserId" FROM "Players"
     WHERE "GameId" = $1 AND "Name" LIKE '__seed__%'`,
    [gameId]
  );
  if (seeded.rows.length === 0) return 0;

  const playerIds = seeded.rows.map(r => r.Id);
  const userIds = seeded.rows.map(r => r.UserId);

  await client.query(`DELETE FROM "Players" WHERE "Id" = ANY($1::text[])`, [playerIds]);
  await client.query(
    `DELETE FROM "Users" WHERE "Id" = ANY($1::text[]) AND "Username" LIKE '__seed__%'`,
    [userIds]
  );
  return playerIds.length;
}

/**
 * Convenience helper: seed N synthetic players for a game with randomized
 * scores so the scoreboard is visibly ordered. Returns the list of seeded
 * player info.
 */
export async function seedScoreboardPlayers(
  client: Client,
  gameId: string,
  sponsorId: string,
  count: number
): Promise<Array<{ playerId: string; userId: string; teamId: string; approvedName: string; score: number }>> {
  const results: Array<{ playerId: string; userId: string; teamId: string; approvedName: string; score: number }> = [];
  for (let i = 0; i < count; i++) {
    const score = 1000 - i * 5; // descending order so ranks match insertion order
    const r = await seedScoreboardPlayer(client, {
      gameId,
      sponsorId,
      score,
      rank: i + 1,
      correctCount: Math.max(1, Math.floor(score / 100)),
      approvedName: `Seeded Team ${String(i + 1).padStart(3, '0')}`,
    });
    results.push({ ...r, score });
  }
  return results;
}

export interface SeedChallengeOptions {
  gameId: string;
  specId: string;
  playerId: string;
  teamId: string;
  /** TopoMojo workspace id (used as ExternalId). */
  externalId: string;
  name: string;
  points?: number;
  /** If set, challenge is considered completed (score === points). */
  completed?: boolean;
  /** Partial score (0..points). Default 0. */
  score?: number;
  /** Session duration in minutes. Default 60. */
  durationMinutes?: number;
  /** Has a deployed TopoMojo gamespace. Default false. */
  hasDeployedGamespace?: boolean;
  /** Pre-existing challenge state JSON. Default minimal state. */
  stateJson?: string;
}

/**
 * Insert a Challenge row for a player. Challenges live under a player+spec+game
 * and drive the challenge-board UI. Seeded rows tag `Name` with `__seed__` for
 * cleanup; they are removed when the parent Player/Game is deleted (FK cascade).
 */
export async function seedChallenge(
  client: Client,
  opts: SeedChallengeOptions
): Promise<{ challengeId: string }> {
  const challengeId = generateEntityId();
  const points = opts.points ?? 100;
  const score = opts.completed ? points : (opts.score ?? 0);
  const duration = opts.durationMinutes ?? 60;
  const defaultState = JSON.stringify({
    id: challengeId,
    name: opts.name,
    challenge: {
      text: opts.name,
      maxAttempts: 3,
      maxPoints: points,
      attempts: 0,
      score,
      sectionCount: 1,
      sectionIndex: 0,
      questions: [
        {
          text: 'Enter the flag',
          hint: '',
          answer: '',
          example: '',
          weight: 1.0,
          penalty: 0,
          isCorrect: opts.completed ?? false,
          isGraded: opts.completed ?? false,
        },
      ],
    },
    vms: [],
    isActive: true,
  });

  await client.query(
    `INSERT INTO "Challenges" (
       "Id", "Name", "SpecId", "ExternalId", "PlayerId", "TeamId", "GameId",
       "Tag", "State", "Points", "Score",
       "LastScoreTime", "LastSyncTime", "WhenCreated",
       "StartTime", "EndTime", "HasDeployedGamespace",
       "GameEngineType", "PlayerMode"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9::text, $10, $11,
       now(), now(), now(),
       now(), now() + ($12 || ' minutes')::interval, $13,
       0, 0
     )`,
    [
      challengeId,
      `__seed__${opts.name}`,
      opts.specId,
      opts.externalId,
      opts.playerId,
      opts.teamId,
      opts.gameId,
      opts.name.toLowerCase().replace(/\s+/g, '-'),
      opts.stateJson ?? defaultState,
      points,
      score,
      String(duration),
      opts.hasDeployedGamespace ?? false,
    ]
  );
  return { challengeId };
}

/**
 * Delete seeded challenge rows for a game (used in teardown when not relying
 * on cascading Game deletion).
 */
export async function cleanupSeededChallenges(
  client: Client,
  gameId: string
): Promise<number> {
  const res = await client.query(
    `DELETE FROM "Challenges" WHERE "GameId" = $1 AND "Name" LIKE '__seed__%'`,
    [gameId]
  );
  return res.rowCount ?? 0;
}

/**
 * Insert a ChallengeSubmission row. Each row records a player's attempted
 * answer for the challenge.
 */
export async function seedChallengeSubmission(
  client: Client,
  opts: {
    challengeId: string;
    answer: string;
    score?: number;
    submittedOffsetMs?: number;
  }
): Promise<string> {
  const id = generateEntityId();
  const answers = JSON.stringify({ answers: [opts.answer] });
  const offset = opts.submittedOffsetMs ?? 0;
  await client.query(
    `INSERT INTO "ChallengeSubmissions" ("Id", "ChallengeId", "SubmittedOn", "Answers", "Score")
     VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, $4::text, $5)`,
    [id, opts.challengeId, String(offset), answers, opts.score ?? 0]
  );
  return id;
}
