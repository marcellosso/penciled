import type { Annotation } from 'penciled/headless';

/** One page as it travels between devices. */
export interface SyncedPage {
  /** The page's id, as `pageId()` makes it. */
  id: string;
  url: string;
  title: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
  annotations: Annotation[];
  /** When each annotation deleted from this page was deleted, by annotation id. */
  deleted: Record<string, string>;
}

// Bumped if the encoding changes, so older versions skip pages they can't read.
const FORMAT = '1';
const ALGORITHM = 'deflate-raw';

// Chrome 123 and Firefox 140, the oldest versions penciled supports, both have CompressionStream
// with deflate-raw, so there's no fallback.
const pipe = async (bytes: BlobPart, through: CompressionStream | DecompressionStream) =>
  new Response(new Blob([bytes]).stream().pipeThrough(through));

async function deflate(text: string): Promise<string> {
  const bytes = new Uint8Array(
    await (await pipe(text, new CompressionStream(ALGORITHM))).arrayBuffer(),
  );
  // Items are JSON strings, so the bytes are written as base64: plain ASCII, nothing to escape.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function inflate(base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return (await pipe(bytes, new DecompressionStream(ALGORITHM))).text();
}

/**
 * A short, stable key for a page. Page ids are URLs, often long, and keys count against the quota.
 * 60 bits of SHA-256; the page's id travels inside, so a collision is caught rather than merged.
 */
export async function pageHash(id: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest).subarray(0, 8)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').slice(0, 10);
}

const chunkKey = (hash: string, i: number) => `${hash}.${i}`;

/** Each chunk starts with `format.revision.count.`, so a page is only read whole. */
const header = (rev: string, count: number) => `${FORMAT}.${rev}.${count}.`;

/**
 * Compresses `page` and splits it into items that each fit in `itemBytes`, as `size` measures
 * them, keyed `${hash}.${index}`.
 */
export async function encodePage(
  hash: string,
  page: SyncedPage,
  itemBytes: number,
  size: (key: string, value: string) => number,
): Promise<Record<string, string>> {
  const data = await deflate(JSON.stringify(page));
  const rev = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(36).padStart(2, '0'),
  ).join('');
  // Room for data in one item, assuming the longest key and header this page could have.
  const longest = chunkKey(hash, 999);
  const room = itemBytes - size(longest, header(rev, 999));
  if (room < 64) throw new Error('Sync items are too small to hold a page.');
  const count = Math.max(1, Math.ceil(data.length / room));
  const items: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    items[chunkKey(hash, i)] = header(rev, count) + data.slice(i * room, (i + 1) * room);
  }
  return items;
}

/** A page's items, as they were read from the transport. */
export interface StoredChunks {
  hash: string;
  /** Every item key the page has, stale chunks included. */
  keys: string[];
  /** The reassembled data, when every chunk of one revision is there. */
  data?: string;
  /** The keys holding `data`, in order. */
  parts?: string[];
}

/** Groups items by page and reassembles the pages whose chunks have all arrived. */
export function assemble(items: Record<string, string>): Map<string, StoredChunks> {
  const pages = new Map<string, { keys: string[]; chunks: Map<number, string> }>();
  for (const [key, value] of Object.entries(items)) {
    const dot = key.lastIndexOf('.');
    const hash = key.slice(0, dot);
    const index = Number(key.slice(dot + 1));
    const page = pages.get(hash) ?? { keys: [] as string[], chunks: new Map<number, string>() };
    page.keys.push(key);
    if (Number.isInteger(index)) page.chunks.set(index, value);
    pages.set(hash, page);
  }
  const result = new Map<string, StoredChunks>();
  for (const [hash, { keys, chunks }] of pages) {
    const first = parseChunk(chunks.get(0));
    let data: string | undefined;
    let parts: string[] = [];
    if (first) {
      parts = [first.data];
      for (let i = 1; i < first.count; i++) {
        const chunk = parseChunk(chunks.get(i));
        // Another device is part-way through writing this page; it's read once it's whole.
        if (!chunk || chunk.rev !== first.rev || chunk.count !== first.count) break;
        parts.push(chunk.data);
      }
      if (parts.length === first.count) data = parts.join('');
    }
    const complete = data !== undefined && {
      data,
      parts: parts.map((_, i) => chunkKey(hash, i)),
    };
    result.set(hash, { hash, keys, ...complete });
  }
  return result;
}

function parseChunk(value: string | undefined) {
  const match = value && /^(\d+)\.(\w+)\.(\d+)\.(.*)$/s.exec(value);
  if (!match || match[1] !== FORMAT) return undefined;
  return { rev: match[2]!, count: Number(match[3]), data: match[4]! };
}

/** The page in reassembled `data`, or nothing if it can't be read. */
export async function decodePage(data: string): Promise<SyncedPage | undefined> {
  try {
    const page = JSON.parse(await inflate(data)) as Partial<SyncedPage> | null;
    if (
      typeof page?.id !== 'string' ||
      !Array.isArray(page.annotations) ||
      typeof page.deleted !== 'object' ||
      page.deleted === null
    ) {
      return undefined;
    }
    return {
      id: page.id,
      url: typeof page.url === 'string' ? page.url : page.id,
      title: typeof page.title === 'string' ? page.title : '',
      updatedAt: typeof page.updatedAt === 'string' ? page.updatedAt : '',
      annotations: page.annotations,
      deleted: page.deleted,
    };
  } catch {
    return undefined;
  }
}
