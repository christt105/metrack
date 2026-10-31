import { describe, expect, it } from 'vitest';
import {
  CloudflarePagesPublisher,
  WRANGLER_INHERITED_ENV,
} from '../src/publish/CloudflarePagesPublisher.js';
import type { CommandOptions, CommandRunner } from '../src/publish/CommandRunner.js';
import { FilePublishState } from '../src/publish/FilePublishState.js';
import { loadPublishConfig } from '../src/publish/loadPublishConfig.js';
import { NodeCommandRunner } from '../src/publish/NodeCommandRunner.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadPublishConfig', () => {
  const env = {
    PUBLISH_SITE_TEMPLATE_DIR: '/site',
    CLOUDFLARE_API_TOKEN: 'token',
    CLOUDFLARE_ACCOUNT_ID: 'account',
    CLOUDFLARE_PAGES_PROJECT: 'metrack-site',
  };

  it('is disabled and names what is missing when a variable is absent', () => {
    expect(loadPublishConfig({})).toEqual({
      config: undefined,
      missing: [
        'PUBLISH_SITE_TEMPLATE_DIR',
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_PAGES_PROJECT',
      ],
    });
    expect(loadPublishConfig({ ...env, CLOUDFLARE_API_TOKEN: '' }).missing).toEqual([
      'CLOUDFLARE_API_TOKEN',
    ]);
  });

  it('reads the settings with defaults for the optional ones', () => {
    expect(loadPublishConfig(env).config).toEqual({
      siteTemplateDir: '/site',
      hugoBinary: 'hugo',
      wranglerBinary: 'wrangler',
      cloudflareApiToken: 'token',
      cloudflareAccountId: 'account',
      cloudflareProject: 'metrack-site',
      cloudflareBranch: 'main',
      baseUrl: undefined,
    });
    expect(
      loadPublishConfig({
        ...env,
        HUGO_BIN: '/opt/hugo',
        WRANGLER_BIN: '/opt/wrangler',
        CLOUDFLARE_PAGES_BRANCH: 'live',
        PUBLISH_BASE_URL: 'https://site.example/',
      }).config,
    ).toMatchObject({
      hugoBinary: '/opt/hugo',
      wranglerBinary: '/opt/wrangler',
      cloudflareBranch: 'live',
      baseUrl: 'https://site.example/',
    });
  });
});

describe('CloudflarePagesPublisher', () => {
  it('runs wrangler with the credentials only in the child environment', async () => {
    const calls: { command: string; args: string[]; options?: CommandOptions }[] = [];
    const runner: CommandRunner = {
      run: async (command, args, options) => void calls.push({ command, args, options }),
    };
    await new CloudflarePagesPublisher(
      {
        wranglerBinary: 'wrangler',
        cloudflareApiToken: 'token',
        cloudflareAccountId: 'account',
        cloudflareProject: 'metrack-site',
        cloudflareBranch: 'main',
      },
      runner,
    ).publish('/built');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.command).toBe('wrangler');
    expect(calls[0]!.args).toEqual([
      'pages',
      'deploy',
      '/built',
      '--project-name',
      'metrack-site',
      '--branch',
      'main',
      '--commit-dirty=true',
    ]);
    expect(calls[0]!.options?.env).toEqual({
      CLOUDFLARE_API_TOKEN: 'token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
    });
    expect(calls[0]!.options?.inheritEnv).toEqual(WRANGLER_INHERITED_ENV);
    expect(calls[0]!.options?.inheritEnv).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(calls[0]!.args.join(' ')).not.toContain('token');
  });
});

describe('FilePublishState', () => {
  const path = () => join(mkdtempSync(join(tmpdir(), 'metrack-state-')), 'sub', 'state.json');

  it('remembers the last fingerprint and starts empty', () => {
    const file = path();
    const state = new FilePublishState(file);
    expect(state.lastFingerprint()).toBeNull();
    state.record('abc');
    expect(new FilePublishState(file).lastFingerprint()).toBe('abc');
  });

  it('treats a corrupt file as never published', () => {
    const file = path();
    const state = new FilePublishState(file);
    state.record('abc');
    writeFileSync(file, '{broken');
    expect(state.lastFingerprint()).toBeNull();
  });
});

describe('NodeCommandRunner', () => {
  const runner = new NodeCommandRunner();

  it('resolves when the command succeeds and passes the environment', async () => {
    await runner.run(
      process.execPath,
      ['-e', 'process.exit(process.env.METRACK_TEST === "1" ? 0 : 3)'],
      { env: { METRACK_TEST: '1' } },
    );
  });

  it('passes only the listed parent variables when inheritEnv is set', async () => {
    process.env.METRACK_KEEP = 'keep';
    process.env.METRACK_SECRET = 'secret';
    try {
      await runner.run(
        process.execPath,
        [
          '-e',
          'const e = process.env; process.exit(e.METRACK_KEEP === "keep" && e.METRACK_SECRET === undefined && e.METRACK_TEST === "1" ? 0 : 3)',
        ],
        { env: { METRACK_TEST: '1' }, inheritEnv: ['METRACK_KEEP'] },
      );
    } finally {
      delete process.env.METRACK_KEEP;
      delete process.env.METRACK_SECRET;
    }
  });

  it('passes every parent variable with a listed prefix', async () => {
    process.env.METRACK_KEEP_A = 'a';
    process.env.METRACK_KEEP_B = 'b';
    process.env.METRACK_SECRET = 'secret';
    try {
      await runner.run(
        process.execPath,
        [
          '-e',
          'const e = process.env; process.exit(e.METRACK_KEEP_A === "a" && e.METRACK_KEEP_B === "b" && e.METRACK_SECRET === undefined ? 0 : 3)',
        ],
        { inheritEnv: ['PATH', 'METRACK_KEEP_*'] },
      );
    } finally {
      delete process.env.METRACK_KEEP_A;
      delete process.env.METRACK_KEEP_B;
      delete process.env.METRACK_SECRET;
    }
  });

  it('rejects with the output tail when the command fails', async () => {
    await expect(
      runner.run(process.execPath, ['-e', 'console.error("boom"); process.exit(2)']),
    ).rejects.toThrow(/exited with code 2: boom/);
  });

  it('rejects when the program does not exist', async () => {
    await expect(runner.run('metrack-no-such-program', [])).rejects.toThrow(/could not start/);
  });
});
