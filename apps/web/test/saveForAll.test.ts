import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { saveForAll } from '../src/logic/saveForAll';

const shared = new ApiRequestError('Other users have this', 409, 'catalog_shared');

describe('saveForAll', () => {
  it('saves once when nothing is shared', async () => {
    const save = vi.fn().mockResolvedValue('saved');
    const confirm = vi.fn();
    expect(await saveForAll(save, true, confirm)).toBe('saved');
    expect(save).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks the owner and saves again for everyone', async () => {
    const save = vi.fn().mockRejectedValueOnce(shared).mockResolvedValueOnce('saved');
    expect(await saveForAll(save, true, () => true)).toBe('saved');
    expect(save).toHaveBeenNthCalledWith(1, {});
    expect(save).toHaveBeenNthCalledWith(2, { forAll: true });
  });

  it('keeps the refusal when the owner declines', async () => {
    const save = vi.fn().mockRejectedValue(shared);
    await expect(saveForAll(save, true, () => false)).rejects.toBe(shared);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never asks anyone but the owner', async () => {
    const save = vi.fn().mockRejectedValue(shared);
    const confirm = vi.fn();
    await expect(saveForAll(save, false, confirm)).rejects.toBe(shared);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not retry other errors', async () => {
    const other = new ApiRequestError('Bad', 400, 'invalid');
    const save = vi.fn().mockRejectedValue(other);
    await expect(saveForAll(save, true, () => true)).rejects.toBe(other);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
