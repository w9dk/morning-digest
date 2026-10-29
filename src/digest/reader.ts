import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunRecord = {
  at: string;
  atMs: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

type MutableRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  firstAtMs: number;
  lastAt: string;
  lastAtMs: number;
  lastErrorAtMs: number | null;
};

const statuses: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRunRecord(value: unknown): RunRecord | null {
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) return null;
  if (typeof job !== 'string' || job.length === 0) return null;
  if (typeof status !== 'string' || !statuses.includes(status as RunStatus)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;

  return {
    at,
    atMs: Date.parse(at),
    job,
    status: status as RunStatus,
    owner,
    ...(typeof error === 'string' ? { error } : {}),
  };
}

function toDigestRow(row: MutableRow): DigestRow {
  return {
    job: row.job,
    owner: row.owner,
    runs: row.runs,
    retries: row.retries,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    firstAt: row.firstAt,
    lastAt: row.lastAt,
  };
}

export const readNight: ReadNight = (runsDir, night): NightDigest => {
  const content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, MutableRow>();
  let malformedLines = 0;

  if (content.length === 0) return { rows: [], malformedLines };

  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {
    if (line.trim() === '') {
      malformedLines += 1;
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    const record = parseRunRecord(value);
    if (!record) {
      malformedLines += 1;
      continue;
    }

    const row = rows.get(record.job);
    if (!row) {
      rows.set(record.job, {
        job: record.job,
        owner: record.owner,
        runs: 1,
        retries: record.status === 'retry' ? 1 : 0,
        lastStatus: record.status,
        lastError: record.error ?? null,
        firstAt: record.at,
        firstAtMs: record.atMs,
        lastAt: record.at,
        lastAtMs: record.atMs,
        lastErrorAtMs: record.error === undefined ? null : record.atMs,
      });
      continue;
    }

    row.runs += 1;
    if (record.status === 'retry') row.retries += 1;

    if (record.atMs < row.firstAtMs) {
      row.firstAt = record.at;
      row.firstAtMs = record.atMs;
    }

    if (record.atMs >= row.lastAtMs) {
      row.owner = record.owner;
      row.lastStatus = record.status;
      row.lastAt = record.at;
      row.lastAtMs = record.atMs;
    }

    if (record.error !== undefined && (row.lastErrorAtMs === null || record.atMs >= row.lastErrorAtMs)) {
      row.lastError = record.error;
      row.lastErrorAtMs = record.atMs;
    }
  }

  return {
    rows: [...rows.values()].sort((left, right) => left.job.localeCompare(right.job)).map(toDigestRow),
    malformedLines,
  };
};
