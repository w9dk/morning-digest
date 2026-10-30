import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const configFor = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

describe('digest routes', () => {
  it('serves the same sorted rows as HTML and JSON', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    try {
      writeFileSync(
        join(runsDir, '2026-10-29.jsonl'),
        [
          JSON.stringify({ at: '2026-10-29T02:00:00+01:00', job: 'zeta', status: 'ok', owner: 'sam' }),
          JSON.stringify({ at: '2026-10-29T01:00:00+01:00', job: 'alpha', status: 'retry', owner: null }),
        ].join('\n'),
      );
      const app = createApp(configFor(runsDir));

      const page = await app.request('/digest/2026-10-29');
      const pageHtml = await page.text();
      expect(page.status).toBe(200);
      expect(pageHtml.indexOf('alpha')).toBeLessThan(pageHtml.indexOf('zeta'));
      expect(pageHtml).toContain('—');

      const response = await app.request('/api/digest/2026-10-29');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        {
          job: 'alpha',
          owner: null,
          runs: 1,
          retries: 1,
          lastStatus: 'retry',
          lastError: null,
          firstAt: '2026-10-29T01:00:00+01:00',
          lastAt: '2026-10-29T01:00:00+01:00',
        },
        {
          job: 'zeta',
          owner: 'sam',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-29T02:00:00+01:00',
          lastAt: '2026-10-29T02:00:00+01:00',
        },
      ]);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    try {
      const app = createApp(configFor(runsDir));
      expect((await app.request('/digest/2026-10-29')).status).toBe(404);
      expect((await app.request('/api/digest/2026-10-29')).status).toBe(404);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('renders an empty night and returns an empty JSON array', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    try {
      writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');
      const app = createApp(configFor(runsDir));

      const page = await app.request('/digest/2026-10-29');
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('nothing ran');

      const response = await app.request('/api/digest/2026-10-29');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('counts a malformed line without breaking either route', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    try {
      writeFileSync(
        join(runsDir, '2026-10-29.jsonl'),
        [
          '{not json',
          JSON.stringify({ at: '2026-10-29T01:00:00+01:00', job: 'alpha', status: 'fail', owner: 'sam' }),
        ].join('\n'),
      );
      const app = createApp(configFor(runsDir));

      const page = await app.request('/digest/2026-10-29');
      const html = await page.text();
      expect(page.status).toBe(200);
      expect(html).toContain('alpha');
      expect(html).toContain('1 malformed line counted');

      const response = await app.request('/api/digest/2026-10-29');
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject([{ job: 'alpha', lastStatus: 'fail' }]);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});
