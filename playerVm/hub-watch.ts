// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Watching what a page actually invokes on a SignalR hub, and what the hub answered.
 *
 * This exists because a failed hub invocation is invisible from every other vantage point. The clients
 * invoke without awaiting - `this.hubConnection.invoke('LeaveVm', vmId)`, promise dropped - so an
 * invocation the server rejects leaves the connection up, logs nothing, throws nothing, and changes nothing
 * on screen. The screen is no help either way: what these calls do is add and remove *group memberships*,
 * and the only proof that a membership changed is a later broadcast arriving or not arriving, which needs a
 * second session and a second user to produce.
 *
 * So the readout is the wire. SignalR's JSON protocol numbers every `invoke` and the server answers it with
 * a completion frame carrying either a result or an error, and that frame is the one thing that says the hub
 * ran the method and how it went. Reading it turns "the client sent something" - which proves only that the
 * client compiled - into "the hub accepted this, by this name, with this many arguments".
 *
 * What this cannot tell you: whether the group the hub joined is the group the broadcasts go to. That is
 * what `live-vm-list.spec.ts` and `console-presence.spec.ts` are for; this is the layer under them.
 */

import { expect, type Page } from '@playwright/test';

/**
 * SignalR's JSON protocol terminates each message with 0x1e, and one frame can carry several.
 *
 * Spelled as a char code rather than as a literal because the character is invisible in an editor and
 * in a diff, and a separator that quietly became the empty string splits a frame into single characters
 * - none of which parse, so every watcher would report a working page as one that invoked nothing.
 */
const RECORD_SEPARATOR = String.fromCharCode(0x1e);

/** One `invoke` or `send` a page put on the wire, and what came back for it. */
export type HubInvocation = {
  target: string;
  arguments: unknown[];
  /**
   * Which connection sent it, counted from 1 in the order the sockets opened.
   *
   * Invocation ids restart at `0` on every connection, so a completion frame can only be matched to an
   * invocation within one socket. A reconnect - `withAutomaticReconnect` is on in both clients - would
   * otherwise let connection 2's first completion mark connection 1's first invocation as answered.
   */
  connection: number;
  /** SignalR's invocation id, or null for a `send`, which the server never answers. */
  invocationId: string | null;
  /** True once the server's completion frame for this invocation arrived. */
  answered: boolean;
  /** The server's error, when it answered with one. A rejected invocation is still `answered`. */
  error?: string;
};

export type HubWatch = {
  /** The hub path this is watching, as it appears in the socket URL. */
  path: string;
  /** Everything sent so far, in order. */
  invocations(): HubInvocation[];
  /**
   * Wait for the hub to answer `target` without an error.
   *
   * Two assertions, in the order that tells them apart: first that an answer arrived at all, then that it
   * was not an error. A method the client never invoked and a method the hub rejected are different bugs -
   * one is a client that stopped calling, the other a call the server refuses - and a single assertion
   * would report them the same way.
   */
  expectCompleted(target: string, options?: ExpectCompletedOptions): Promise<void>;
};

export type ExpectCompletedOptions = {
  /** Narrows to invocations whose arguments match, for a target invoked more than once. */
  match?: (args: unknown[]) => boolean;
  /** Default 60s: a first invocation waits on the connection, the token and the handshake. */
  timeout?: number;
  /** What it means if this never arrives, in the failure message. */
  why?: string;
};

/** The messages a frame carries, ignoring anything that is not JSON (the handshake terminator, mostly). */
function messages(payload: string | Buffer): Array<Record<string, unknown>> {
  return String(payload)
    .split(RECORD_SEPARATOR)
    .filter((part) => part.length > 0)
    .flatMap((part) => {
      try {
        const parsed = JSON.parse(part);

        return parsed && typeof parsed === 'object' ? [parsed as Record<string, unknown>] : [];
      } catch {
        return [];
      }
    });
}

/** One line per invocation, for a failure message: the whole conversation, in order. */
function transcript(invocations: HubInvocation[]): string {
  if (invocations.length === 0) {
    return '  (nothing - the page never invoked anything on this hub)';
  }

  return invocations
    .map((x) => {
      const state = x.error
        ? `rejected: ${x.error}`
        : x.answered
          ? 'answered'
          : x.invocationId === null
            ? 'sent with send(), which the server never answers'
            : 'no answer';

      return `  #${x.connection} ${x.target}(${x.arguments.length} arg${
        x.arguments.length === 1 ? '' : 's'
      }) - ${state}`;
    })
    .join('\n');
}

/**
 * Start recording the invocations a page makes on one hub.
 *
 * **Call this before the navigation that opens the connection.** `page.on('websocket')` only reports sockets
 * opened after it is registered, and every client here connects during the first component's `ngOnInit` -
 * so a watcher attached after `goto` sees an empty transcript and reports a working page as a broken one.
 */
export function watchHub(page: Page, hubPath: string): HubWatch {
  const invocations: HubInvocation[] = [];
  let connections = 0;

  page.on('websocket', (ws) => {
    // The other socket on a dev-served page is the Angular dev server's HMR channel.
    if (!ws.url().includes(hubPath)) {
      return;
    }

    const connection = ++connections;

    ws.on('framesent', (frame) => {
      for (const message of messages(frame.payload)) {
        // Type 1 is an invocation. Type 6 is a keep-alive ping, and the handshake is not typed at all.
        if (message.type === 1 && typeof message.target === 'string') {
          invocations.push({
            target: message.target,
            arguments: Array.isArray(message.arguments) ? message.arguments : [],
            connection,
            invocationId: typeof message.invocationId === 'string' ? message.invocationId : null,
            answered: false,
          });
        }
      }
    });

    ws.on('framereceived', (frame) => {
      for (const message of messages(frame.payload)) {
        if (message.type !== 3) {
          continue;
        }

        for (const invocation of invocations) {
          if (
            invocation.connection === connection &&
            invocation.invocationId !== null &&
            invocation.invocationId === message.invocationId
          ) {
            invocation.answered = true;

            if (typeof message.error === 'string') {
              invocation.error = message.error;
            }
          }
        }
      }
    });
  });

  return {
    path: hubPath,
    invocations: () => [...invocations],

    async expectCompleted(target, options = {}) {
      const { match, timeout = 60000, why } = options;
      const matching = () =>
        invocations.filter((x) => x.target === target && (!match ? true : match(x.arguments)));

      try {
        // The polled value is a list rather than a boolean so the report distinguishes an invocation that
        // was never sent (`[]`) from one still waiting for its answer (`['no answer']`).
        await expect
          .poll(() => matching().map((x) => (x.answered ? 'answered' : 'no answer')), {
            timeout,
            intervals: [250, 500, 1000],
          })
          .toContain('answered');
      } catch {
        throw new Error(
          `The ${hubPath} hub never answered ${target}${match ? ' with the expected arguments' : ''}. ` +
            `${why ?? ''}\n\nWhat the page invoked on ${hubPath}:\n${transcript(invocations)}`
        );
      }

      const rejected = matching().filter((x) => x.error);

      expect(
        rejected.map((x) => `${target}(${x.arguments.length}): ${x.error}`),
        `The hub rejected ${target}. The client invokes it without awaiting the promise, so this failure ` +
          'is invisible in the browser: the connection stays up and the group membership simply never ' +
          'changes.'
      ).toEqual([]);
    },
  };
}
