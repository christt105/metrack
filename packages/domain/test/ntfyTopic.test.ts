import { describe, expect, it } from 'vitest';
import { generateNtfyTopic, ntfySubscriptionUrl, settingProblem } from '../src/index.js';

describe('generateNtfyTopic', () => {
  it('encodes the random bytes in lowercase base32 after the prefix', () => {
    expect(generateNtfyTopic((length) => new Uint8Array(length))).toBe(`metrack-${'a'.repeat(32)}`);
    expect(generateNtfyTopic((length) => new Uint8Array(length).fill(255))).toBe(
      `metrack-${'7'.repeat(32)}`,
    );
    expect(generateNtfyTopic((length) => Uint8Array.from({ length }, (_, index) => index))).toBe(
      'metrack-aaaqeayeaudaocajbifqydiob4ibceqt',
    );
  });

  it('asks for 160 bits and yields a topic ntfy and the settings accept', () => {
    let asked = 0;
    const topic = generateNtfyTopic((length) => {
      asked = length;
      return crypto.getRandomValues(new Uint8Array(length));
    });
    expect(asked * 8).toBe(160);
    expect(topic).toMatch(/^metrack-[a-z2-7]{32}$/);
    expect(topic.length).toBeLessThanOrEqual(64);
    expect(settingProblem('ntfyTopic', topic)).toBeNull();
  });

  it('differs between calls with a real random source', () => {
    const random = (length: number) => crypto.getRandomValues(new Uint8Array(length));
    expect(generateNtfyTopic(random)).not.toBe(generateNtfyTopic(random));
  });
});

describe('ntfySubscriptionUrl', () => {
  it('points at the topic on ntfy.sh', () => {
    expect(ntfySubscriptionUrl('metrack-abc')).toBe('https://ntfy.sh/metrack-abc');
  });
});
