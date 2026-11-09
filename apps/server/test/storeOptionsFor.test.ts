import { describe, expect, it } from 'vitest';
import { SharpImageEncoder } from '../src/images/SharpImageEncoder.js';
import { storeOptionsFor } from '../src/images/storeOptionsFor.js';
import { WebpValidatingEncoder } from '../src/images/WebpValidatingEncoder.js';

const limits = {
  quotaBytes: 100,
  maxUploadBytes: 50,
  maxDimension: 1920,
  quality: 82,
  encodedBy: 'server' as const,
};

describe('storeOptionsFor', () => {
  it('re-encodes with sharp when the server encodes', () => {
    const options = storeOptionsFor(limits);
    expect(options.encoder).toBeInstanceOf(SharpImageEncoder);
    expect(options.encodedBy).toBe('server');
  });

  it('only validates WebP when the browser encodes', () => {
    const options = storeOptionsFor({ ...limits, encodedBy: 'client' });
    expect(options.encoder).toBeInstanceOf(WebpValidatingEncoder);
    expect(options.encodedBy).toBe('client');
  });
});
