import { describe, expect, it } from 'vitest';
import { AccountDeletionService } from '../src/account/AccountDeletionService.js';
import type { UnusedImageRemover } from '../src/account/UnusedImageRemover.js';
import type { AccountRepository } from '../src/storage/repositories/AccountRepository.js';
import type { UserRepository } from '../src/storage/repositories/UserRepository.js';

function setup(images: UnusedImageRemover | null) {
  const lines: string[] = [];
  const logger = { info: (m: string) => lines.push(m), error: (m: string) => lines.push(`E ${m}`) };
  const accounts = {
    dueForDeletion: async () => [5],
    erase: async () => ['aa', 'bb', 'cc'],
  } as unknown as AccountRepository;
  const service = new AccountDeletionService(
    accounts,
    {} as UserRepository,
    images,
    null,
    logger,
    () => new Date('2026-11-20T03:00:00Z'),
  );
  return { service, lines };
}

describe('AccountDeletionService images', () => {
  it('removes the unused images of the erased account when it has an image remover', async () => {
    const asked: (readonly string[])[] = [];
    const { service, lines } = setup({
      removeUnused: async (hashes) => {
        asked.push(hashes);
        return ['aa'];
      },
    });
    expect(await service.eraseDue()).toEqual([5]);
    expect(asked).toEqual([['aa', 'bb', 'cc']]);
    expect(lines).toEqual(['deleted account 5 (3 images owned, 1 removed)']);
  });

  it('only erases the account and leaves the images when it has none', async () => {
    const { service, lines } = setup(null);
    expect(await service.eraseDue()).toEqual([5]);
    expect(lines).toEqual(['deleted account 5 (3 images owned, left for the image cleanup)']);
  });
});
