// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Reading the contract files `vm.api` publishes, and reading the client sources that are supposed to
 * honour them.
 *
 * These are the only specs in this suite that assert against source rather than against a running
 * service, and the reason is that there is nothing running to assert against. A SignalR method name and
 * a generated TypeScript interface are agreed on at build time by two repositories that never see each
 * other; by the time a browser is involved the mismatch has already happened, and what it looks like is
 * a stale VM list or an `undefined` field, not an error anyone can catch. So this reads both sides.
 *
 * Nothing here writes to an application repository. `../AGENTS.md` allows reading app source to verify a
 * contract and nothing else, and these helpers only ever read.
 */

import fs from 'fs';
import path from 'path';

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

/** The directory an app name in a contract file refers to. */
export function appDirectory(app: string): string {
  const directories: Record<string, () => string> = {
    'vm.api': AppSources.vmApi,
    'vm.ui': AppSources.vmUi,
    'console.ui': AppSources.consoleUi,
  };

  const directory = directories[app];

  if (!directory) {
    throw new Error(
      `No source directory is known for the app '${app}'. Contract files name apps as 'vm.ui', ` +
        `'console.ui' or 'vm.api'.`
    );
  }

  return directory();
}

export function contractsDirectory(): string {
  return path.join(AppSources.vmApi(), 'contracts');
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** True when every path given exists, which is the precondition every spec here has. */
export function allPresent(...paths: string[]): boolean {
  return paths.every((x) => fs.existsSync(x));
}

// --- The shape of contracts/signalr-contract.json -------------------------------------------------

export type ContractClient = { app: string; source: string };

export type ContractInvocation = {
  name: string;
  arguments: number;
  returns?: { collection: boolean; keys: string[] };
  note?: string;
};

export type ContractBroadcast = {
  name: string;
  arguments: number[];
  sentBy: string[];
  note?: string;
};

export type ContractUnsentListener = { name: string; listenedForBy: string[]; note?: string };

export type ContractHub = {
  name: string;
  path: string;
  hubType: string;
  clients: ContractClient[];
  invocations: ContractInvocation[];
  broadcasts: ContractBroadcast[];
  clientListenersWithNoSender: ContractUnsentListener[];
};

export type SignalRContract = {
  description: string;
  hubs: ContractHub[];
  modifiedProperties: {
    description: string;
    names: string[];
    neverSent: { description: string; keys: string[] };
  };
};

// --- The shape of contracts/openapi-surface.json --------------------------------------------------

export type SurfaceOperation = {
  operationId?: string;
  tags?: string[];
  parameters?: string[];
  requestBody?: { required: boolean; content: Record<string, string> };
  responses: Record<string, Record<string, string> | null>;
};

export type SurfaceSchema = {
  type: string;
  required?: string[];
  properties?: Record<string, string>;
};

export type OpenApiSurface = {
  openapi: string;
  operations: Record<string, SurfaceOperation>;
  schemas: Record<string, SurfaceSchema>;
};

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

const OPENING = '([{<';
const CLOSING = ')]}>';

/**
 * The source with comments removed and every string's contents blanked out, so a brace inside a
 * comment or a quoted `)` cannot be mistaken for structure. The result is the same length as the input,
 * so an index into it indexes the original.
 */
function mask(source: string): string {
  const out = source.split('');
  let quote: string | null = null;
  let comment: 'line' | 'block' | null = null;

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
        out[i + 1] = ' ';
        i++;
      } else if (c === quote) {
        quote = null;
      } else if (c !== '\n') {
        out[i] = ' ';
      }
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
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

/** The half-open range of what a bracket opening at `open` contains. */
function contents(masked: string, open: number): [number, number] {
  let depth = 0;

  for (let i = open; i < masked.length; i++) {
    if (OPENING.includes(masked[i])) {
      depth++;
    } else if (CLOSING.includes(masked[i]) && --depth === 0) {
      return [open + 1, i];
    }
  }

  throw new Error(`Unbalanced '${masked[open]}' at offset ${open} while reading a hub call.`);
}

/** The half-open range of each top-level comma-separated item in `[from, to)`. */
function items(masked: string, from: number, to: number): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  let depth = 0;
  let start = from;

  for (let i = from; i < to; i++) {
    const c = masked[i];

    if (OPENING.includes(c)) depth++;
    else if (CLOSING.includes(c)) depth--;
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

  for (const match of masked.matchAll(/\.(on|invoke|send)\s*\(/g)) {
    const kind = match[1] === 'on' ? 'on' : 'invoke';
    const open = match.index + match[0].length - 1;
    const [from, to] = contents(masked, open);

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
      count: kind === 'on' ? handlerArity(masked, from, to, name) : items(masked, from, to).length - 1,
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

  const [start, end] = contents(masked, afterName + paren);

  return items(masked, start, end).length;
}

/** Every hub path a client dials, taken from its `withUrl` calls. */
export function hubPaths(source: string): string[] {
  return [...mask(source).matchAll(/withUrl\s*\(/g)].map((match) => {
    const open = match.index + match[0].length - 1;
    const [from, to] = contents(mask(source), open);
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
