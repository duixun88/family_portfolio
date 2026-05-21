export type Owner = '태훈' | '예솔' | '태린';
export type AssetType = 'stock' | 'etf' | 'deposit' | 'insurance' | 'cash' | 'bond' | 'fund';
export type AccountType =
  | 'IRP' | '연금저축' | 'ISA'
  | '퇴직연금DC' | '퇴직연금DB'
  | '일반' | 'CMA' | '예금계좌' | '기타';
export type AccountCategory = '절세' | '퇴직' | '일반';

export interface Account {
  id: string;
  owner: Owner;
  type: AccountType;
  broker: string;
  accountNumber?: string;
  currency: 'KRW' | 'USD' | 'MULTI';
  memo?: string;
  createdAt: string;
}

export interface Holding {
  id: string;
  accountId: string;
  assetType: AssetType;
  name: string;
  addedAt: string;
  memo?: string;

  // Stock / ETF
  ticker?: string;
  market?: string;
  tradeCurrency?: string;
  quantity?: number;
  avgPrice?: number;

  // Fixed-value assets (deposit, insurance, cash, bond, fund)
  principal?: number;       // 원금 (KRW)
  currentValue?: number;    // 현재평가액 (KRW) — manual
  maturityDate?: string;
  interestRate?: number;
}

export interface PriceData {
  price: number;
  currency: string;
  date: string;
  name?: string;
  ts?: number;
}

export type PriceMap = Record<string, PriceData>;

export interface ActiveView {
  type: 'all' | 'owner' | 'account';
  owner?: Owner;
  accountId?: string;
}
