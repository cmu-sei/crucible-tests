// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Gallery API helper functions for CITE integration tests.
 * These functions interact directly with the Gallery REST API to set up
 * test data (collections, cards, articles, exhibits, teams, memberships)
 * that the CITE UI tests rely on.
 */

import https from 'https';
import http from 'http';

const GALLERY_API = 'http://localhost:4722/api';
const KEYCLOAK_TOKEN_URL = 'https://localhost:8443/realms/crucible/protocol/openid-connect/token';

/** Node https agent that ignores self-signed certificates (dev only) */
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Low-level HTTP(S) request helper that works with Node's built-in modules.
 * Needed because native fetch in Node rejects self-signed certificates.
 */
function nodeRequest(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(
      url,
      {
        method: options.method,
        headers: options.headers,
        ...(isHttps ? { agent: insecureAgent } : {}),
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Get an access token from Keycloak using resource owner password grant.
 * The gallery.admin client with gallery scope is used.
 */
export async function getKeycloakToken(
  username = 'admin',
  password = 'admin'
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'gallery.admin',
    username,
    password,
    scope: 'openid gallery',
  }).toString();

  const response = await nodeRequest(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to get Keycloak token: ${response.status} ${response.body}`);
  }

  const data = JSON.parse(response.body);
  return data.access_token;
}

// ─── Generic API helpers ───

async function apiPost(token: string, path: string, body: any): Promise<any> {
  const response = await nodeRequest(`${GALLERY_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`POST ${path} failed: ${response.status} ${response.body}`);
  }

  return JSON.parse(response.body);
}

async function apiGet(token: string, path: string): Promise<any> {
  const response = await nodeRequest(`${GALLERY_API}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`GET ${path} failed: ${response.status} ${response.body}`);
  }

  return JSON.parse(response.body);
}

async function apiDelete(token: string, path: string): Promise<void> {
  const response = await nodeRequest(`${GALLERY_API}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status >= 300 && response.status !== 404) {
    throw new Error(`DELETE ${path} failed: ${response.status} ${response.body}`);
  }
}

// ─── Collection ───

export async function createGalleryCollection(
  token: string,
  data: { name: string; description?: string }
): Promise<any> {
  return apiPost(token, '/collections', data);
}

export async function deleteGalleryCollection(token: string, collectionId: string): Promise<void> {
  return apiDelete(token, `/collections/${collectionId}`);
}

// ─── Card ───

export async function createGalleryCard(
  token: string,
  data: {
    name: string;
    description?: string;
    move: number;
    inject: number;
    collectionId: string;
  }
): Promise<any> {
  return apiPost(token, '/cards', data);
}

// ─── Article ───

export async function createGalleryArticle(
  token: string,
  data: {
    name: string;
    summary?: string;
    description?: string;
    collectionId: string;
    exhibitId?: string;
    cardId?: string;
    move: number;
    inject: number;
    status: string;
    sourceType: string;
    sourceName?: string;
    url?: string;
    datePosted?: string;
    openInNewTab?: boolean;
  }
): Promise<any> {
  return apiPost(token, '/articles', data);
}

// ─── Exhibit ───

export async function createGalleryExhibit(
  token: string,
  data: {
    collectionId: string;
    currentMove?: number;
    currentInject?: number;
  }
): Promise<any> {
  return apiPost(token, '/exhibits', data);
}

export async function deleteGalleryExhibit(token: string, exhibitId: string): Promise<void> {
  return apiDelete(token, `/exhibits/${exhibitId}`);
}

// ─── Team ───

export async function createGalleryTeam(
  token: string,
  data: {
    name: string;
    shortName?: string;
    exhibitId: string;
  }
): Promise<any> {
  return apiPost(token, '/teams', data);
}

// ─── TeamCard ───

export async function createGalleryTeamCard(
  token: string,
  data: {
    teamId: string;
    cardId: string;
    move?: number;
    inject?: number;
    isShownOnWall?: boolean;
    canPostArticles?: boolean;
  }
): Promise<any> {
  return apiPost(token, '/teamcards', {
    move: 0,
    inject: 0,
    isShownOnWall: true,
    canPostArticles: false,
    ...data,
  });
}

// ─── TeamUser ───

export async function addUserToGalleryTeam(
  token: string,
  teamId: string,
  userId: string
): Promise<any> {
  return apiPost(token, '/teamusers', { teamId, userId });
}

// ─── Users ───

export async function getGalleryUsers(token: string): Promise<any[]> {
  return apiGet(token, '/users');
}
