/**
 * Supabase cloud sync.
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Falls back to localStorage-only if env vars are missing.
 *
 * Supabase table DDL:
 *   CREATE TABLE portfolio_data (
 *     id TEXT PRIMARY KEY DEFAULT 'main',
 *     data JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE portfolio_data ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "allow_all" ON portfolio_data FOR ALL USING (true) WITH CHECK (true);
 */
import { createClient } from '@supabase/supabase-js';
import type { Holding, Account, PriceMap } from './types';

export interface CloudData {
  holdings: Holding[];
  accounts: Account[];
  prices: PriceMap;
  fxRate: number;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isCloudEnabled = !!(url && key);

const client = isCloudEnabled ? createClient(url!, key!) : null;

const ROW_ID = 'main';

/** 클라우드에서 전체 포트폴리오 데이터 로드 */
export async function loadFromCloud(): Promise<CloudData | null> {
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('portfolio_data')
      .select('data')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error || !data) return null;
    return data.data as CloudData;
  } catch {
    return null;
  }
}

/** 전체 포트폴리오 데이터를 클라우드에 저장 */
export async function saveToCloud(payload: CloudData): Promise<boolean> {
  if (!client) return false;
  try {
    const { error } = await client
      .from('portfolio_data')
      .upsert({
        id: ROW_ID,
        data: payload,
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}
