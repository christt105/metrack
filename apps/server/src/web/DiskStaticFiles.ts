import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { getMimeType } from 'hono/utils/mime';
import { bytesBody } from '../api/bytesBody.js';
import type { StaticFiles } from './StaticFiles.js';

const CACHE_CONTROL = 'public, max-age=0';
const TYPE_OVERRIDES: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
};

/** Serves the files of a directory, with validators and byte ranges so browsers revalidate instead of downloading again. */
export class DiskStaticFiles implements StaticFiles {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async file(pathname: string, request: Request): Promise<Response | undefined> {
    let relative: string;
    try {
      relative = decodeURIComponent(pathname);
    } catch {
      return undefined;
    }
    if (relative.includes('\0')) return undefined;
    if (relative.endsWith('/')) relative += 'index.html';
    return this.send(resolve(join(this.root, relative)), request);
  }

  index(request: Request): Promise<Response | undefined> {
    return this.send(join(this.root, 'index.html'), request);
  }

  private async send(path: string, request: Request): Promise<Response | undefined> {
    if (path !== this.root && !path.startsWith(this.root + sep)) return undefined;
    const info = await stat(path).catch(() => undefined);
    if (!info?.isFile()) return undefined;
    const etag = `W/"${info.size.toString(16)}-${info.mtime.getTime().toString(16)}"`;
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': CACHE_CONTROL,
      'Last-Modified': info.mtime.toUTCString(),
      ETag: etag,
    });
    if (isFresh(request, etag, info.mtime)) return new Response(null, { status: 304, headers });
    headers.set(
      'Content-Type',
      TYPE_OVERRIDES[extname(path)] ?? getMimeType(path) ?? 'application/octet-stream',
    );
    const bytes = new Uint8Array(await readFile(path));
    const range = byteRange(request, etag, bytes.byteLength);
    if (range === 'unsatisfiable') {
      headers.set('Content-Range', `bytes */${bytes.byteLength}`);
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
      headers.set('Content-Length', String(range.end - range.start + 1));
      return new Response(bytesBody(bytes.subarray(range.start, range.end + 1)), {
        status: 206,
        headers,
      });
    }
    headers.set('Content-Length', String(bytes.byteLength));
    return new Response(bytesBody(bytes), { headers });
  }
}

function isFresh(request: Request, etag: string, modified: Date): boolean {
  if (/no-cache/i.test(request.headers.get('cache-control') ?? '')) return false;
  const match = request.headers.get('if-none-match');
  if (match !== null) {
    return match.split(',').some((entry) => entry.trim().replace(/^W\//, '') === etag.slice(2));
  }
  const since = Date.parse(request.headers.get('if-modified-since') ?? '');
  return !Number.isNaN(since) && Math.floor(modified.getTime() / 1000) * 1000 <= since;
}

function byteRange(
  request: Request,
  etag: string,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | undefined {
  const header = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  if (header === null || (ifRange !== null && ifRange !== etag)) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return undefined;
  let start: number;
  let end: number;
  if (match[1] === '') {
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start >= size || start > end ? 'unsatisfiable' : { start, end };
}
