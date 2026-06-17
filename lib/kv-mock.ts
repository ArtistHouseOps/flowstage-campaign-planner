type Item = { value: unknown; expiresAt?: number };

// Anchored to globalThis so the in-memory KV survives Next.js dev HMR module
// re-evaluation. Without this, a server component and an API route handler
// can see different stores after a hot reload.
const G = globalThis as unknown as {
  __kvMockStore?: Map<string, Item>;
  __kvMockZsets?: Map<string, Map<string, number>>;
};
G.__kvMockStore ??= new Map<string, Item>();
G.__kvMockZsets ??= new Map<string, Map<string, number>>();
const store = G.__kvMockStore;
const zsets = G.__kvMockZsets;

function liveItem(key: string): Item | null {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return item;
}

function setKey(key: string, value: unknown, opts?: { ex?: number }) {
  const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
  store.set(key, { value, expiresAt });
}

function getKey<T>(key: string): T | null {
  const item = liveItem(key);
  return item ? (item.value as T) : null;
}

function zaddOne(key: string, member: string, score: number) {
  let zset = zsets.get(key);
  if (!zset) {
    zset = new Map();
    zsets.set(key, zset);
  }
  zset.set(member, score);
}

function zrangeKeys(
  key: string,
  start: number,
  end: number,
  rev: boolean,
): string[] {
  const zset = zsets.get(key);
  if (!zset) return [];
  const sorted = [...zset.entries()].sort((a, b) =>
    rev ? b[1] - a[1] : a[1] - b[1],
  );
  const actualEnd = end === -1 ? sorted.length - 1 : end;
  return sorted.slice(start, actualEnd + 1).map(([m]) => m);
}

type ZAddArg = { score: number; member: string };

export function createMockRedis() {
  const api = {
    async get<T>(key: string): Promise<T | null> {
      return getKey<T>(key);
    },

    async set<T>(
      key: string,
      value: T,
      opts?: { ex?: number },
    ): Promise<"OK"> {
      setKey(key, value, opts);
      return "OK";
    },

    async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
      return keys.map((k) => getKey<unknown>(k)) as T;
    },

    async zadd(key: string, member: ZAddArg): Promise<number> {
      const existed = zsets.get(key)?.has(member.member) ?? false;
      zaddOne(key, member.member, member.score);
      return existed ? 0 : 1;
    },

    async zrange<T extends string[]>(
      key: string,
      start: number,
      end: number,
      opts?: { rev?: boolean },
    ): Promise<T> {
      return zrangeKeys(key, start, end, Boolean(opts?.rev)) as T;
    },

    pipeline() {
      const queue: Array<() => Promise<unknown>> = [];
      const p = {
        set: (key: string, value: unknown, opts?: { ex?: number }) => {
          queue.push(async () => {
            setKey(key, value, opts);
            return "OK";
          });
          return p;
        },
        get: (key: string) => {
          queue.push(async () => getKey<unknown>(key));
          return p;
        },
        zadd: (key: string, member: ZAddArg) => {
          queue.push(async () => {
            zaddOne(key, member.member, member.score);
            return 1;
          });
          return p;
        },
        async exec<T = unknown[]>(): Promise<T> {
          const results: unknown[] = [];
          for (const op of queue) results.push(await op());
          return results as T;
        },
      };
      return p;
    },
  };
  return api;
}

export type MockRedis = ReturnType<typeof createMockRedis>;
