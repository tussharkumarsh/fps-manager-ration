import { put, head, del } from "@vercel/blob";
import * as XLSX from "xlsx";

/**
 * Generic read-modify-write wrapper around a single .xlsx workbook stored in
 * Vercel Blob storage.
 *
 * CACHING NOTE: Vercel Blob enforces a minimum CDN cache TTL on blob bodies
 * (observed: 60s, via the `cacheControl` header on `head()` — it silently
 * floors whatever `cacheControlMaxAge` a `put()` requests). This means a
 * plain SDK `get()`/body fetch shortly after a write can return stale
 * content. `head()`/metadata calls, however, are NOT subject to this and are
 * always fresh. So every read here: (1) calls `head()` first to get the
 * current, authoritative `etag`, then (2) fetches the body with a
 * cache-busting query string derived from that etag + `cache: "no-store"` —
 * a URL never seen before can't be served from a pre-existing cache entry,
 * guaranteeing the body matches the etag we just confirmed is current.
 *
 * CONCURRENCY NOTE: Vercel serverless functions are stateless and run across
 * many isolated invocations/regions — there is no in-memory mutex that can
 * coordinate concurrent writers the way a single long-lived process could.
 * This client therefore implements *optimistic* concurrency only: a write
 * captures the blob's `etag` (always fresh, per above) before mutating, and
 * re-checks it immediately before writing — if another writer raced ahead in
 * the meantime the etag will have changed, and the whole read-modify-write
 * cycle is retried (up to `maxAttempts`) with a short backoff before giving
 * up and throwing. This is best-effort, not a guarantee — acceptable here
 * because each dealer's data lives in its own blob and is written by one
 * dealer at a time, not many concurrent writers hammering the same blob.
 */

export type WorkbookMutator<T> = (wb: XLSX.WorkBook) => T | Promise<T>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ensures a sheet exists with the given header row if missing. Leaves existing data alone. */
export function ensureSheet(wb: XLSX.WorkBook, sheetName: string, headers: string[]): void {
  if (!wb.SheetNames.includes(sheetName)) {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
}

function freshWorkbook(sheets: { name: string; headers: string[] }[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) ensureSheet(wb, s.name, s.headers);
  return wb;
}

/** Fresh (non-cached) metadata lookup. Returns null if the blob doesn't exist. */
async function freshHead(path: string): Promise<{ etag: string; downloadUrl: string } | null> {
  try {
    const meta = await head(path);
    return { etag: meta.etag, downloadUrl: meta.downloadUrl };
  } catch {
    // head() throws when the blob doesn't exist (or on other lookup
    // failures) — treat any failure as "not found" so callers fall back to
    // a fresh workbook rather than crashing on a blob that hasn't been
    // created yet.
    return null;
  }
}

/** Fetches the blob body, guaranteed fresh as of the given etag (see file header note). */
async function downloadBlobBody(downloadUrl: string, etag: string): Promise<ArrayBuffer> {
  const bustUrl = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}_v=${encodeURIComponent(etag)}`;
  const res = await fetch(bustUrl, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`BlobXlsxClient: failed to download blob body (status ${res.status})`);
  }
  return res.arrayBuffer();
}

async function readWorkbookWithEtag(
  path: string,
  defaultSheets: { name: string; headers: string[] }[]
): Promise<{ wb: XLSX.WorkBook; etag: string | null }> {
  const meta = await freshHead(path);
  if (!meta) return { wb: freshWorkbook(defaultSheets), etag: null };

  try {
    const buf = await downloadBlobBody(meta.downloadUrl, meta.etag);
    const wb = XLSX.read(buf, { type: "array" });
    for (const s of defaultSheets) ensureSheet(wb, s.name, s.headers);
    return { wb, etag: meta.etag };
  } catch {
    return { wb: freshWorkbook(defaultSheets), etag: meta.etag };
  }
}

/** Reads the workbook at `path`, returning a fresh workbook if missing/corrupt. */
export async function readWorkbook(
  path: string,
  defaultSheets: { name: string; headers: string[] }[]
): Promise<XLSX.WorkBook> {
  const { wb } = await readWorkbookWithEtag(path, defaultSheets);
  return wb;
}

function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Reads the workbook at `path`, applies `mutate` to it in-memory, and writes
 * it back with optimistic-concurrency retries: if the blob's etag changed
 * between our read and write, we re-read, re-apply the mutation, and try
 * again (up to `maxAttempts` times) before throwing.
 */
export async function mutateWorkbook<T>(
  path: string,
  defaultSheets: { name: string; headers: string[] }[],
  mutate: WorkbookMutator<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { wb, etag: etagAtLoad } = await readWorkbookWithEtag(path, defaultSheets);

    const result = await mutate(wb);

    const currentMeta = await freshHead(path);
    const etagNow = currentMeta?.etag ?? null;

    if (etagNow !== etagAtLoad) {
      lastErr = new Error(
        `BlobXlsxClient: conflict writing ${path} (etag was ${etagAtLoad}, now ${etagNow})`
      );
      await sleep(150 * 2 ** attempt + Math.random() * 100);
      continue;
    }

    const buffer = workbookToBuffer(wb);
    await put(path, buffer, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return result;
  }
  throw new Error(
    `BlobXlsxClient: failed to write ${path} after ${maxAttempts} attempts due to concurrent writers. ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}

/** Reads a sheet's rows as an array of plain objects keyed by header. */
export function sheetToRows<T>(wb: XLSX.WorkBook, sheetName: string): T[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: "" });
}

/** Replaces a sheet's contents with the given rows (objects keyed by header). */
export function rowsToSheet<T extends Record<string, unknown>>(
  wb: XLSX.WorkBook,
  sheetName: string,
  rows: T[],
  headers: string[]
): void {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  if (wb.SheetNames.includes(sheetName)) {
    wb.Sheets[sheetName] = ws;
  } else {
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
}

/** Deletes a blob (mostly useful for tests/admin tooling). */
export async function deleteBlob(path: string): Promise<void> {
  await del(path);
}
