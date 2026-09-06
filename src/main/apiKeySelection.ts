import type { ApiTier } from './modelChain';

export function selectActiveApiKey(apiTier: ApiTier, freeKey: string, paidKey: string): string {
  return apiTier === 'paid' ? (paidKey || freeKey) : freeKey;
}
