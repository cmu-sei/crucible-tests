// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Reading the client sources that are supposed to honour the VM API's contracts: the two Angular SignalR
 * services, and the API client `vm.ui` generates and checks in.
 *
 * Mostly source rather than a running service, and the reason is that there is nothing running to assert
 * against. A SignalR method name and a generated TypeScript interface are agreed on at build time by two
 * repositories that never see each other; by the time a browser is involved the mismatch has already
 * happened, and what it looks like is a stale VM list or an `undefined` field, not an error anyone can
 * catch. So this reads both sides — the API's half lives in `api-sources.ts`.
 *
 * There is deliberately nothing here that reads a contract file. `vm.api` used to publish
 * `contracts/signalr-contract.json` and `contracts/openapi-surface.json`, and both were removed from the
 * application with the tests that generated them. A spec pointed at a file that will never exist again
 * does not fail — it skips, or collects no tests at all, and reports green forever. So the API's SignalR
 * surface is now derived from its C# (`api-sources.ts`) and its OpenAPI document is fetched from the
 * running service ({@link fetchOpenApiDocument}).
 *
 * Nothing here writes to an application repository. `../AGENTS.md` allows reading app source to verify a
 * contract and nothing else, and these helpers only ever read.
 */

import fs from 'fs';
import path from 'path';
import { request as playwrightRequest } from '@playwright/test';
import { Services } from '../shared-fixtures';

/**
 * Where the Crucible application repositories are checked out. The default is the directory that holds
 * this one, which is how the workspace is laid out; `CRUCIBLE_SOURCE_ROOT` overrides it.
 */
export function sourceRoot(): string {
  return process.env.CRUCIBLE_SOURCE_ROOT ?? path.resolve(__dirname, '../..');
}

export const AppSources = {
  vmApi: () => path.join(sourceRoot(), 'player', 'vm.api'),
  vmUi: () => path.join(sourceRoot(), 'player', 'vm.ui'),
  consoleUi: () => path.join(sourceRoot(), 'player', 'console.ui'),
} as const;

/** The directory an app name in a spec's client table refers to. */
export function appDirectory(app: string): string {
  const directories: Record<string, () => string> = {
    'vm.api': AppSources.vmApi,
    'vm.ui': AppSources.vmUi,
    'console.ui': AppSources.consoleUi,
  };

  const directory = directories[app];

  if (!directory) {
    throw new Error(
      `No source directory is known for the app '${app}'. The contract specs name apps as 'vm.ui', ` +
        `'console.ui' or 'vm.api'.`
    );
  }

  return directory();
}

/** True when every path given exists, which is the precondition every spec here has. */
export function allPresent(...paths: string[]): boolean {
  return paths.every((x) => fs.existsSync(x));
}

// --- The API's OpenAPI document -------------------------------------------------------------------

/** As much of an OpenAPI document as a generated client is built out of. */
export type OpenApiDocument = {
  openapi?: string;
  paths?: Record<string, Record<string, { operationId?: string; tags?: string[] }>>;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown>; enum?: unknown[] }> };
};

export type SurfaceOperation = { operationId?: string; tags: string[] };

/** A schema as the generator sees it: an object with properties, an enum with values, or neither. */
export type SurfaceSchema = { properties: string[] | null; values: string[] | null };

export type OpenApiSurface = {
  /** Keyed `'GET /api/vms/{id}'`, which is how a failure names the operation that moved. */
  operations: Record<string, SurfaceOperation>;
  schemas: Record<string, SurfaceSchema>;
};

/** The HTTP methods an OpenAPI path item can hold. Anything else in there describes the path, not an operation. */
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/**
 * The parts of an OpenAPI document a generated client is made of: operation ids and tags, because they
 * become method and service names, and schema properties and enum values, because they become interfaces
 * and union types.
 *
 * Separated from the fetch so the shape of this transformation is testable without a running API —
 * `contract-reader.spec.ts` drives it from a fixture document.
 */
export function openApiSurfaceFrom(document: OpenApiDocument): OpenApiSurface {
  const operations: Record<string, SurfaceOperation> = {};

  for (const [route, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item?.[method];

      if (operation) {
        operations[`${method.toUpperCase()} ${route}`] = {
          operationId: operation.operationId,
          tags: operation.tags ?? [],
        };
      }
    }
  }

  const schemas: Record<string, SurfaceSchema> = {};

  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    schemas[name] = {
      properties: schema?.properties ? Object.keys(schema.properties) : null,
      // Read as strings because that is what the generator emits into a union type, whatever the
      // document's declared type is.
      values: schema?.enum ? schema.enum.map((x) => String(x)) : null,
    };
  }

  return { operations, schemas };
}

/** Where the VM API serves the document `npm run swagger:gen` in `vm.ui` is pointed at. */
export function openApiDocumentUrl(): string {
  return `${Services.PlayerVM.API.replace(/\/$/, '')}/swagger/v1/swagger.json`;
}

/**
 * The OpenAPI document the API is serving right now, or null when nothing is listening.
 *
 * The line between the two is whether the service answered at all, and it is drawn there on purpose. A
 * refused connection is an environment fact — the API is not running — and the specs treat it as a
 * precondition. A *reply* that is not a document is not: the service is up and no longer serving the thing
 * `npm run swagger:gen` is pointed at, which is worth a failure rather than a skip, so this throws.
 *
 * Unauthenticated, because the swagger middleware sits outside the endpoint routing that
 * `RequireAuthorization` applies to; a 401 would mean that changed, and it arrives here as a thrown error
 * saying so rather than as apparent drift in the client.
 */
export async function fetchOpenApiDocument(): Promise<OpenApiDocument | null> {
  const url = openApiDocumentUrl();
  const context = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });

  try {
    let response;

    try {
      response = await context.fetch(url);
    } catch {
      // Transport-level: refused, unresolved, timed out. Nothing answered, so there is nothing to
      // compare the checked-in client against.
      return null;
    }

    if (!response.ok()) {
      throw new Error(
        `${url} answered ${response.status()}, so the API is running but is not serving an OpenAPI ` +
          'document at the path the client is generated from. That is a change in the API rather than ' +
          'drift in the generated client.'
      );
    }

    return (await response.json()) as OpenApiDocument;
  } finally {
    await context.dispose();
  }
}

// --- Reading the client sources -------------------------------------------------------------------

/** One `hubConnection.on(...)` or `hubConnection.invoke(...)` found in a client source. */
export type HubCall = {
  /** `'on'` for a handler registration, `'invoke'` for a call to the server. */
  kind: 'on' | 'invoke';
  /** The method name, as the client spells it. */
  name: string;
  /**
   * For `'on'`, how many parameters the handler binds. For `'invoke'`, how many arguments are passed
   * after the name. Both are the halves of the contract SignalR dispatches on and neither side checks.
   */
  count: number;
};

/**
 * Bracket pairs for `bracketContents` — parentheses, square brackets and braces, and deliberately *not* `<`
 * and `>`. Finding the `)` that closes a `(` does not need angle brackets, and counting them there is
 * actively wrong: a comparison inside a call argument (`a > b`) closes a bracket that was never opened,
 * which silently truncates the argument range and miscounts the call's arity.
 */
const CONTENTS_OPENING = '([{';
const CONTENTS_CLOSING = ')]}';

/**
 * Bracket pairs for `commaItems` — angle brackets included, because a generic type in a parameter list
 * (`Map<string, Vm>`) holds a comma that must not split an argument. Depth is clamped at zero there so
 * a stray comparison cannot suppress a real split.
 */
const OPENING = '([{<';
const CLOSING = ')]}>';

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
 * Whether the `/` at `at` opens a regex literal, judged from what precedes it in the output so far
 * (already masked, so scanning back over whitespace skips comments and strings too).
 *
 * A regex literal cannot follow a value, so the question is whether the last significant character
 * could have ended one. `)` is genuinely ambiguous (`if (x) /re/.test(y)`) and is read as a value here,
 * which is the common case.
 */
function startsRegexLiteral(out: string[], at: number): boolean {
  let j = at - 1;
  while (j >= 0 && /\s/.test(out[j])) j--;
  if (j < 0) return true;

  if (/[\w$)\]'"`]/.test(out[j])) {
    // Unless it closes a keyword: `return /re/` looks like `n /` from here.
    let start = j;
    while (start >= 0 && /[\w$]/.test(out[start])) start--;
    return REGEX_PRECEDING_KEYWORDS.has(out.slice(start + 1, j + 1).join(''));
  }

  return true;
}

/**
 * The source with comments removed and every string's and regex literal's contents blanked out, so a
 * brace inside a comment or a quoted `)` cannot be mistaken for structure. The result is the same length
 * as the input, so an index into it indexes the original.
 *
 * Regex literals are masked for the same reason as strings, and getting it wrong is worse: the quote
 * characters in a pattern like `/'/g` would otherwise open a phantom string that blanks the quotes of
 * the following `.on('VmCreated', …)`, and `hubCalls` would fail claiming a hub call does not name a
 * string literal — a red contract suite blaming this reader rather than the app it is reading.
 *
 * `scripts/check-self-skips.mjs` has a near-identical scanner. Keep the two in step; they are separate
 * only because that one has to run under plain `node`, with no TypeScript loader.
 */
function mask(source: string): string {
  const out = source.split('');
  let quote: string | null = null;
  let comment: 'line' | 'block' | null = null;
  let regex: 'literal' | 'class' | null = null;

  for (let i = 0; i < out.length; i++) {
    const c = out[i];

    if (comment === 'line') {
      if (c === '\n') comment = null;
      else out[i] = ' ';
      continue;
    }

    if (comment === 'block') {
      if (c === '*' && out[i + 1] === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        comment = null;
      } else if (c !== '\n') {
        out[i] = ' ';
      }
      continue;
    }

    if (quote) {
      if (c === '\\') {
        out[i] = ' ';
        // Bounded: a backslash as the final character would otherwise append a
        // character and break the "same length as the input" invariant this
        // function's callers index against.
        if (i + 1 < out.length) out[i + 1] = ' ';
        i++;
      } else if (c === quote) {
        quote = null;
      } else if (c !== '\n') {
        out[i] = ' ';
      }
      continue;
    }

    if (regex) {
      if (c === '\\') {
        out[i] = ' ';
        if (i + 1 < out.length) out[i + 1] = ' ';
        i++;
      } else if (c === '\n') {
        // An unterminated literal: it was a division after all. Nothing already
        // blanked can be recovered, but at least stop here rather than eating the
        // rest of the file.
        regex = null;
      } else if (regex === 'class') {
        out[i] = ' ';
        if (c === ']') regex = 'literal';
      } else if (c === '[') {
        out[i] = ' ';
        regex = 'class';
      } else if (c === '/') {
        // Closing delimiter. Left in place, like a quote, so the literal is still
        // recognisable as one.
        regex = null;
      } else {
        out[i] = ' ';
      }
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }

    if (c === '/' && out[i + 1] !== '/' && out[i + 1] !== '*' && startsRegexLiteral(out, i)) {
      regex = 'literal';
      continue;
    }

    if (c === '/' && out[i + 1] === '/') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i++;
      comment = 'line';
      continue;
    }

    if (c === '/' && out[i + 1] === '*') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i++;
      comment = 'block';
      continue;
    }

    // Masked because `>` would otherwise close a generic that was never opened, and an arrow function
    // is the second argument of every `.on` call here.
    if (c === '=' && out[i + 1] === '>') {
      out[i] = '-';
      out[i + 1] = '-';
      i++;
    }
  }

  return out.join('');
}

/**
 * The half-open range of what a bracket opening at `open` contains.
 *
 * Exported for `api-sources.ts`, which reads C#: bracket matching over a *masked* source is the same
 * problem in either language, and a second copy of it is a second thing to get wrong.
 */
export function bracketContents(masked: string, open: number): [number, number] {
  let depth = 0;

  for (let i = open; i < masked.length; i++) {
    if (CONTENTS_OPENING.includes(masked[i])) {
      depth++;
    } else if (CONTENTS_CLOSING.includes(masked[i]) && --depth === 0) {
      return [open + 1, i];
    }
  }

  throw new Error(`Unbalanced '${masked[open]}' at offset ${open} while reading a hub call.`);
}

/** The half-open range of each top-level comma-separated item in `[from, to)`. Exported with {@link bracketContents}. */
export function commaItems(masked: string, from: number, to: number): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  let depth = 0;
  let start = from;

  for (let i = from; i < to; i++) {
    const c = masked[i];

    if (OPENING.includes(c)) depth++;
    // Clamped, so a `>` that closes nothing — a comparison rather than a generic —
    // cannot drive depth negative and suppress every split after it.
    else if (CLOSING.includes(c)) depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      found.push([start, i]);
      start = i + 1;
    }
  }

  found.push([start, to]);

  return found.filter(([a, b]) => masked.slice(a, b).trim().length > 0);
}

/**
 * Every `.on(...)` and `.invoke(...)` in a client source, with the name each one names and the number
 * of arguments or handler parameters it uses.
 *
 * Read out of the source text rather than by running the client, because the point is the strings the
 * client was written with. A `.on` whose handler cannot be found, or a call whose first argument is not
 * a literal, throws: silently returning fewer calls than the file contains would turn this into a test
 * that passes because it read nothing.
 */
export function hubCalls(source: string): HubCall[] {
  const masked = mask(source);
  const found: HubCall[] = [];

  // The optional `<...>` is the type argument of a generic call: `.invoke<Vm>('GetVm', id)` is how the
  // generated clients spell a typed invoke, and a matcher that only allowed `.invoke(` skipped it
  // silently — so a client calling a hub method the API does not declare passed the contract test.
  for (const match of masked.matchAll(/\.(on|invoke|send)\s*(?:<[^<>()]*>\s*)?\(/g)) {
    const kind = match[1] === 'on' ? 'on' : 'invoke';
    const open = match.index + match[0].length - 1;
    const [from, to] = bracketContents(masked, open);

    // The name comes out of the original, because the mask blanked the quotes' contents.
    const name = /^\s*['"`]([A-Za-z][A-Za-z0-9_]*)['"`]/.exec(source.slice(from, to))?.[1];

    if (!name) {
      throw new Error(
        `A .${match[1]}( call at offset ${open} does not start with a string literal, so the hub ` +
          'method it names cannot be read. Either it is not a hub call, or this reader needs work.'
      );
    }

    found.push({
      kind,
      name,
      count: kind === 'on' ? handlerArity(masked, from, to, name) : commaItems(masked, from, to).length - 1,
    });
  }

  return found;
}

/**
 * How many parameters the handler of an `.on` call binds.
 *
 * Read by finding the parameter list itself rather than by splitting the call's arguments, because the
 * handler body is arbitrary code - a `>` in a comparison would unbalance anything that tried to scan
 * through it - and the parameter list never is.
 */
function handlerArity(masked: string, from: number, to: number, name: string): number {
  const afterName = masked.indexOf(',', from) + 1;

  if (afterName <= 0 || afterName >= to) {
    throw new Error(`The .on('${name}') call has no handler argument.`);
  }

  const rest = masked.slice(afterName, to);
  const arrow = rest.indexOf('--');

  if (arrow < 0) {
    throw new Error(
      `The handler of .on('${name}') is not an arrow function. This reader counts parameters by ` +
        'finding the list before the arrow.'
    );
  }

  const before = rest.slice(0, arrow);
  const paren = before.indexOf('(');

  // `(a, b) => ...` and `a => ...` are both legal; the second binds exactly one.
  if (paren < 0) {
    return before.trim().length > 0 ? 1 : 0;
  }

  const [start, end] = bracketContents(masked, afterName + paren);

  return commaItems(masked, start, end).length;
}

/** Every hub path a client dials, taken from its `withUrl` calls. */
export function hubPaths(source: string): string[] {
  return [...mask(source).matchAll(/withUrl\s*\(/g)].map((match) => {
    const open = match.index + match[0].length - 1;
    const [from, to] = bracketContents(mask(source), open);
    const url = source.slice(from, to);

    return /(\/hubs\/[A-Za-z0-9_-]+)/.exec(url)?.[1] ?? url.trim();
  });
}

// --- Reading the generated API client -------------------------------------------------------------

/** The generated client `vm.ui` has checked in, as the model and service files it is made of. */
export function generatedClientDirectory(): string {
  return path.join(AppSources.vmUi(), 'src', 'app', 'generated', 'vm-api');
}

/**
 * A name reduced to what a comparison across the two sides can rely on: the OpenAPI generator changes
 * casing and drops separators when it turns an `operationId` into a method name and a tag into a
 * service name, so `Health_GetLiveliness` and `healthGetLiveliness` are the same thing and a rename is
 * not.
 */
export function normalizeName(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

/** The exported model type names in the generated client. */
export function generatedModels(): string[] {
  const directory = path.join(generatedClientDirectory(), 'model');

  return fs
    .readdirSync(directory)
    .filter((x) => x.endsWith('.ts') && x !== 'models.ts')
    .flatMap((file) => {
      const source = fs.readFileSync(path.join(directory, file), 'utf8');

      return [...source.matchAll(/^export (?:interface|type) (\w+)/gm)].map((x) => x[1]);
    })
    .filter((x, i, all) => all.indexOf(x) === i);
}

/** The property names of a generated model interface, in declaration order. */
export function generatedInterfaceProperties(model: string): string[] {
  const source = readGeneratedModel(model);
  const declaration = new RegExp(`^export interface ${model} \\{([\\s\\S]*?)^\\}`, 'm').exec(source);

  if (!declaration) {
    return null;
  }

  return [...declaration[1].matchAll(/^\s{4}(\w+)\??:/gm)].map((x) => x[1]);
}

/** The values of a generated enum model, in declaration order. */
export function generatedEnumValues(model: string): string[] {
  const source = readGeneratedModel(model);
  const declaration = new RegExp(`^export type ${model} = ([^;]+);`, 'm').exec(source);

  if (!declaration) {
    return null;
  }

  return [...declaration[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

function readGeneratedModel(model: string): string {
  const file = path.join(
    generatedClientDirectory(),
    'model',
    `${model[0].toLowerCase()}${model.slice(1)}.ts`
  );

  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** The generated service files, as the tag each is named for and the methods it declares. */
export function generatedServices(): Array<{ file: string; methods: string[] }> {
  const directory = path.join(generatedClientDirectory(), 'api');

  return fs
    .readdirSync(directory)
    .filter((x) => x.endsWith('.service.ts'))
    .map((file) => {
      const source = fs.readFileSync(path.join(directory, file), 'utf8');

      return {
        file: file.replace('.service.ts', ''),
        // Overloads repeat the name three times before the implementation, hence the deduplication.
        methods: [...source.matchAll(/^\s{4}public (\w+)\(/gm)]
          .map((x) => x[1])
          .filter((x, i, all) => all.indexOf(x) === i),
      };
    });
}
