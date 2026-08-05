import 'server-only';

import { ToeicToolError, type DictionaryLookupResult } from '../toolContracts';

export interface DictionaryLookupProvider {
  lookup(term: string, context?: string): Promise<DictionaryLookupResult>;
}

/** No provider is configured in this repository. Keep the boundary explicit. */
export function createToeicDictionaryProvider(): DictionaryLookupProvider {
  return { async lookup() { throw new ToeicToolError('LOOKUP_UNAVAILABLE', 'Dictionary provider is not configured.'); } };
}
