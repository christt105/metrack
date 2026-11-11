import { describe, expect, it, vi } from 'vitest';
import type { AccountExportData } from '../src/api/AccountExportData';
import { buildAccountExport } from '../src/logic/buildAccountExport';
import { readZip } from './readZip';

function exportData(): AccountExportData {
  return {
    exportedAt: '2026-03-05T12:00:00.000Z',
    user: { id: 7 },
    movies: [{ title: 'Matrix' }],
    images: [
      { hash: 'a', file: 'images/a.webp' },
      { hash: 'b', file: 'images/b.webp' },
      { hash: 'c', file: null },
      { hash: 'd', file: 'images/d.webp' },
    ],
  };
}

describe('buildAccountExport', () => {
  it('packs data.json and the image files under the server layout and name', async () => {
    const imageBytes = vi.fn(async (hash: string) => new Uint8Array([hash.charCodeAt(0), 1, 2]));
    const progress: string[] = [];
    const result = await buildAccountExport(
      { accountExportData: async () => exportData(), imageBytes },
      ({ done, total }) => progress.push(`${done}/${total}`),
    );

    expect(result.fileName).toBe('metrack-export-user-7-2026-03-05.zip');
    expect(result.missing).toEqual([]);
    expect(imageBytes).toHaveBeenCalledTimes(3);
    expect(progress[0]).toBe('0/3');
    expect(progress.at(-1)).toBe('3/3');

    const members = await readZip(result.blob);
    expect([...members.keys()].sort()).toEqual([
      'data.json',
      'images/a.webp',
      'images/b.webp',
      'images/d.webp',
    ]);
    expect([...members.get('images/b.webp')!]).toEqual([98, 1, 2]);
    const data = JSON.parse(members.get('data.json')!.toString('utf8'));
    expect(data.movies).toEqual([{ title: 'Matrix' }]);
    expect(data.images.map((i: { file: string | null }) => i.file)).toEqual([
      'images/a.webp',
      'images/b.webp',
      null,
      'images/d.webp',
    ]);
  });

  it('keeps going when an image fails, marking it file: null', async () => {
    const result = await buildAccountExport({
      accountExportData: async () => exportData(),
      imageBytes: async (hash) => {
        if (hash === 'b') throw new Error('gone');
        return new Uint8Array([1]);
      },
    });

    expect(result.missing).toEqual(['b']);
    const members = await readZip(result.blob);
    expect(members.has('images/b.webp')).toBe(false);
    const data = JSON.parse(members.get('data.json')!.toString('utf8'));
    expect(data.images[1]).toEqual({ hash: 'b', file: null });
  });

  it('fetches at most four images at a time', async () => {
    const data = exportData();
    data.images = Array.from({ length: 12 }, (_, i) => ({
      hash: `h${i}`,
      file: `images/h${i}.webp`,
    }));
    let active = 0;
    let peak = 0;
    await buildAccountExport({
      accountExportData: async () => data,
      imageBytes: async () => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return new Uint8Array([1]);
      },
    });
    expect(peak).toBe(4);
  });

  it('fails when the data cannot be fetched', async () => {
    await expect(
      buildAccountExport({
        accountExportData: async () => {
          throw new Error('offline');
        },
        imageBytes: async () => new Uint8Array(),
      }),
    ).rejects.toThrow('offline');
  });
});
