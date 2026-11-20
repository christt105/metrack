import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/ApiError.js';
import { SteamClient } from '../src/providers/steam/SteamClient.js';
import { parseSteamProfile } from '../src/steam/parseSteamProfile.js';
import { SteamIdResolver } from '../src/steam/SteamIdResolver.js';
import { pathFetch } from './support/pathFetch.js';

const ID = '76561198012345678';

describe('parseSteamProfile', () => {
  it('reads a SteamID64, with surrounding spaces', () => {
    expect(parseSteamProfile(` ${ID} `)).toEqual({ kind: 'id', steamId: ID });
  });

  it('reads profile addresses with and without scheme, www and trailing slash', () => {
    for (const text of [
      `https://steamcommunity.com/profiles/${ID}`,
      `http://www.steamcommunity.com/profiles/${ID}/`,
      `steamcommunity.com/profiles/${ID}`,
    ]) {
      expect(parseSteamProfile(text)).toEqual({ kind: 'id', steamId: ID });
    }
    expect(parseSteamProfile('https://steamcommunity.com/id/gaben/')).toEqual({
      kind: 'vanity',
      name: 'gaben',
    });
    expect(parseSteamProfile('steamcommunity.com/id/some_name-1')).toEqual({
      kind: 'vanity',
      name: 'some_name-1',
    });
  });

  it('reads a bare vanity name', () => {
    expect(parseSteamProfile('gaben')).toEqual({ kind: 'vanity', name: 'gaben' });
  });

  it('refuses anything else', () => {
    for (const text of [
      '',
      'a',
      'two words',
      'https://example.com/id/gaben',
      'https://steamcommunity.com/profiles/123',
      'https://steamcommunity.com/id/',
      'https://steamcommunity.com/groups/abc',
    ]) {
      expect(parseSteamProfile(text)).toBeNull();
    }
  });
});

describe('SteamIdResolver', () => {
  const vanity = 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/';

  it('keeps an id without asking Steam', async () => {
    const net = pathFetch({});
    const resolver = new SteamIdResolver(new SteamClient(net.fetch, 'secret'));
    expect(await resolver.resolve(`https://steamcommunity.com/profiles/${ID}`)).toBe(ID);
    expect(net.calls).toEqual([]);
  });

  it('resolves a vanity name through Steam with the key', async () => {
    const net = pathFetch({ [vanity]: { response: { success: 1, steamid: ID } } });
    const resolver = new SteamIdResolver(new SteamClient(net.fetch, 'secret'));
    expect(await resolver.resolve('https://steamcommunity.com/id/gaben')).toBe(ID);
    const url = new URL(net.calls[0] ?? '');
    expect(url.searchParams.get('vanityurl')).toBe('gaben');
    expect(url.searchParams.get('key')).toBe('secret');
  });

  it('answers 400 for a vanity name Steam does not know and for text that is no profile', async () => {
    const net = pathFetch({ [vanity]: { response: { success: 42 } } });
    const resolver = new SteamIdResolver(new SteamClient(net.fetch, 'secret'));
    await expect(resolver.resolve('nobody')).rejects.toMatchObject({
      status: 400,
      code: 'steam_profile_not_found',
    });
    await expect(resolver.resolve('two words')).rejects.toMatchObject({
      status: 400,
      code: 'invalid_steam_profile',
    });
  });

  it('answers 501 for a vanity name when no key is configured, and 502 when Steam fails', async () => {
    await expect(new SteamIdResolver(null).resolve('gaben')).rejects.toMatchObject({
      status: 501,
      code: 'steam_not_configured',
    });
    const down = new SteamIdResolver(new SteamClient(pathFetch({}).fetch, 'secret'));
    const error = await down.resolve('gaben').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'steam_unavailable' });
    expect(String((error as Error).message)).not.toContain('secret');
  });
});
