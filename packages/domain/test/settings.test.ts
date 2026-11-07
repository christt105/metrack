import { describe, expect, it } from 'vitest';
import { applySettingsPatch, settingProblem, type UserSettings } from '../src/index.js';

const empty: UserSettings = {
  jellyfinUser: null,
  ntfyTopic: null,
  publishProject: null,
  publishBaseUrl: null,
  mirrorDir: null,
  mirrorLinkPrefix: null,
};

describe('settingProblem', () => {
  it('accepts sensible values', () => {
    expect(settingProblem('jellyfinUser', 'Haku Otaku')).toBeNull();
    expect(settingProblem('ntfyTopic', 'metrack_2-alerts')).toBeNull();
    expect(settingProblem('publishProject', 'media-tracker')).toBeNull();
    expect(settingProblem('publishBaseUrl', 'https://media-tracker-9yy.pages.dev/')).toBeNull();
    expect(settingProblem('mirrorDir', '/vault/Media Tracker')).toBeNull();
    expect(settingProblem('mirrorLinkPrefix', 'Atlas/Media Tracker')).toBeNull();
  });

  it('rejects values the jobs could not use', () => {
    expect(settingProblem('ntfyTopic', 'my topic')).not.toBeNull();
    expect(settingProblem('publishProject', 'Media_Tracker')).not.toBeNull();
    expect(settingProblem('publishProject', '-media')).not.toBeNull();
    expect(settingProblem('publishBaseUrl', 'javascript:alert(1)')).not.toBeNull();
    expect(settingProblem('publishBaseUrl', 'media-tracker.pages.dev')).not.toBeNull();
    expect(settingProblem('mirrorDir', 'vault/Media Tracker')).not.toBeNull();
    expect(settingProblem('mirrorLinkPrefix', '/Media Tracker')).not.toBeNull();
    expect(settingProblem('mirrorLinkPrefix', 'Media/../Diario')).not.toBeNull();
    expect(settingProblem('jellyfinUser', 'admin\n')).not.toBeNull();
    expect(settingProblem('jellyfinUser', 'x'.repeat(513))).not.toBeNull();
  });
});

describe('applySettingsPatch', () => {
  it('trims, clears empty values and leaves the rest alone', () => {
    const current = { ...empty, jellyfinUser: 'admin', ntfyTopic: 'metrack' };
    const result = applySettingsPatch(current, {
      jellyfinUser: '  haku ',
      ntfyTopic: '',
      publishProject: null,
    });
    expect(result).toEqual({ ok: true, settings: { ...empty, jellyfinUser: 'haku' } });
  });

  it('reports every problem and changes nothing', () => {
    const result = applySettingsPatch(empty, {
      jellyfinUser: 'admin',
      ntfyTopic: 'bad topic',
      publishBaseUrl: 'ftp://x',
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? {} : Object.keys(result.problems)).toEqual(['ntfyTopic', 'publishBaseUrl']);
  });
});
