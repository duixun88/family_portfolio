import { Holding, Account, PriceMap } from './types';

const KEYS = {
  holdings: 'fp:holdings:v4',
  accounts: 'fp:accounts:v4',
  prices: 'fp:prices:v4',
  fx: 'fp:fx:v4',
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const storage = {
  loadHoldings: () => load<Holding[]>(KEYS.holdings, []),
  loadAccounts: () => load<Account[]>(KEYS.accounts, []),
  loadPrices: () => load<PriceMap>(KEYS.prices, {}),
  loadFxRate: () => load<{ rate: number }>(KEYS.fx, { rate: 1380 }).rate,

  saveHoldings: (v: Holding[]) => save(KEYS.holdings, v),
  saveAccounts: (v: Account[]) => save(KEYS.accounts, v),
  savePrices: (v: PriceMap) => save(KEYS.prices, v),
  saveFxRate: (rate: number) => save(KEYS.fx, { rate, ts: Date.now() }),
};
