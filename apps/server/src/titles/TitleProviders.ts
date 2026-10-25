import type { SearchableType } from '@metrack/domain';
import type { TitleProvider } from './TitleProvider.js';

export class TitleProviders {
  private readonly byType = new Map<SearchableType, TitleProvider>();

  register(provider: TitleProvider): void {
    this.byType.set(provider.type, provider);
  }

  get(type: SearchableType): TitleProvider | undefined {
    return this.byType.get(type);
  }
}
