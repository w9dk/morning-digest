import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));

describe('readNight', () => {
  it('groups valid records and counts malformed lines in the supplied night', () => {
    const digest = readNight(runsDir, '2026-10-28');

    expect(digest.malformedLines).toBe(1);
    expect(digest.rows).toHaveLength(5);
    expect(digest.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('keeps null owners and reports the latest status and most recent error', () => {
    const digest = readNight(runsDir, '2026-10-28');
    const render = digest.rows.find((row) => row.job === 'digest/render');
    const refresh = digest.rows.find((row) => row.job === 'fixtures/refresh');

    expect(render).toMatchObject({ job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok' });
    expect(refresh).toMatchObject({
      job: 'fixtures/refresh',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('returns no rows or malformed lines for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    try {
      writeFileSync(join(dir, '2026-10-29.jsonl'), '');
      expect(readNight(dir, '2026-10-29')).toEqual({ rows: [], malformedLines: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
