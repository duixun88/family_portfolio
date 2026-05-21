'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Account, Holding, PriceMap, Owner, AccountCategory } from '@/lib/types';
import { ACCOUNT_META, CATEGORY_COLOR } from '@/lib/accountMeta';

interface Props {
  accounts: Account[];
  holdings: Holding[];
  prices: PriceMap;
  fxRate: number;
  getKrwValue: (h: Holding) => number;
  getKrwCost: (h: Holding) => number;
}

const OWNERS: Owner[] = ['태훈', '예솔', '태린'];
const OWNER_COLORS = ['#f97316', '#3b82f6', '#10b981'];

const ASSET_COLORS: Record<string, string> = {
  stock: '#f97316',
  etf: '#fb923c',
  deposit: '#3b82f6',
  insurance: '#8b5cf6',
  cash: '#10b981',
  bond: '#06b6d4',
  fund: '#ec4899',
};

const ASSET_LABELS: Record<string, string> = {
  stock: '주식', etf: 'ETF', deposit: '예금',
  insurance: '보험', cash: '현금', bond: '채권', fund: '펀드',
};

const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const fmtM = (n: number) => {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return fmt(n);
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-gray-900 border border-gray-700 px-3 py-2 text-xs">
      <div className="text-gray-300 font-bold">{d.name}</div>
      <div className="text-orange-300">₩{fmt(d.value)}</div>
      <div className="text-gray-500">{d.payload.pct?.toFixed(1)}%</div>
    </div>
  );
};

export default function Dashboard({ accounts, holdings, prices, fxRate, getKrwValue, getKrwCost }: Props) {
  const totalValue = holdings.reduce((s, h) => s + getKrwValue(h), 0);
  const totalCost = holdings.reduce((s, h) => s + getKrwCost(h), 0);
  const totalPnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // 자산 유형별
  const byAssetType = Object.entries(
    holdings.reduce<Record<string, number>>((acc, h) => {
      const v = getKrwValue(h);
      acc[h.assetType] = (acc[h.assetType] || 0) + v;
      return acc;
    }, {})
  )
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: ASSET_LABELS[k] || k, value: Math.round(v), pct: totalValue > 0 ? (v / totalValue) * 100 : 0, key: k }))
    .sort((a, b) => b.value - a.value);

  // 계좌 구분별 (절세/퇴직/일반)
  const byCat = (['절세', '퇴직', '일반'] as AccountCategory[]).map((cat) => {
    const ids = accounts.filter(a => ACCOUNT_META[a.type].category === cat).map(a => a.id);
    const v = holdings.filter(h => ids.includes(h.accountId)).reduce((s, h) => s + getKrwValue(h), 0);
    return { name: cat, value: Math.round(v), pct: totalValue > 0 ? (v / totalValue) * 100 : 0 };
  }).filter(d => d.value > 0);

  // 인원별
  const byOwner = OWNERS.map((owner, i) => {
    const ids = accounts.filter(a => a.owner === owner).map(a => a.id);
    const v = holdings.filter(h => ids.includes(h.accountId)).reduce((s, h) => s + getKrwValue(h), 0);
    const cost = holdings.filter(h => ids.includes(h.accountId)).reduce((s, h) => s + getKrwCost(h), 0);
    return { name: owner, value: Math.round(v), cost: Math.round(cost), color: OWNER_COLORS[i] };
  });

  // 절세계좌 납입 현황 (연간 한도 대비)
  const taxAccounts = accounts.filter(a => ACCOUNT_META[a.type].annualLimitKrw);
  // We can't know actual contributions from holdings alone, so show account value vs limit
  const taxLimitRows = taxAccounts.map(a => {
    const meta = ACCOUNT_META[a.type];
    const val = holdings.filter(h => h.accountId === a.id).reduce((s, h) => s + getKrwValue(h), 0);
    const limit = (meta.annualLimitKrw || 0) * 10000;
    const pct = limit > 0 ? Math.min((val / limit) * 100, 100) : 0;
    return { ...a, meta, val, limit, pct };
  });

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="총 자산" value={`₩${fmtM(totalValue)}`} sub={`${fmt(totalValue)}원`} color="text-orange-300" />
        <SummaryCard label="총 매입" value={`₩${fmtM(totalCost)}`} sub={`${accounts.length}개 계좌`} color="text-gray-300" />
        <SummaryCard
          label="평가손익"
          value={`${totalPnl >= 0 ? '+' : ''}₩${fmtM(totalPnl)}`}
          sub={`${totalPnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
          color={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <SummaryCard label="보유 종목" value={`${holdings.length}개`} sub={`주식/ETF ${holdings.filter(h => h.assetType === 'stock' || h.assetType === 'etf').length}개`} color="text-blue-300" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 자산 유형 파이 */}
        <ChartBox title="자산 유형별 비중">
          {byAssetType.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byAssetType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, pct }) => `${name} ${pct.toFixed(0)}%`} labelLine={false}>
                  {byAssetType.map((entry) => (
                    <Cell key={entry.key} fill={ASSET_COLORS[entry.key] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        {/* 계좌 구분 파이 */}
        <ChartBox title="계좌 구분별 (절세/퇴직/일반)">
          {byCat.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, pct }) => `${name} ${pct.toFixed(0)}%`} labelLine={false}>
                  {byCat.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLOR[entry.name as AccountCategory]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        {/* 인원별 막대 */}
        <ChartBox title="인원별 자산">
          {byOwner.every(o => o.value === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byOwner} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [`₩${fmt(v)}`, '평가']}
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 0, fontSize: 11 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {byOwner.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {byOwner.map((o) => (
              <div key={o.name} className="flex items-center justify-between text-[10px]">
                <span style={{ color: o.color }} className="font-bold">{o.name}</span>
                <span className="text-gray-300">₩{fmtM(o.value)}</span>
                <span className={o.value - o.cost >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {o.value - o.cost >= 0 ? '+' : ''}₩{fmtM(o.value - o.cost)}
                </span>
              </div>
            ))}
          </div>
        </ChartBox>
      </div>

      {/* 계좌별 비중 바 */}
      <div className="bg-gray-900/40 border border-gray-700 p-4">
        <div className="text-gray-400 text-[10px] font-bold mb-3 tracking-wider">계좌별 자산 비중</div>
        <div className="space-y-2">
          {accounts
            .map(a => {
              const v = holdings.filter(h => h.accountId === a.id).reduce((s, h) => s + getKrwValue(h), 0);
              return { ...a, krwValue: v };
            })
            .sort((a, b) => b.krwValue - a.krwValue)
            .map(a => {
              const meta = ACCOUNT_META[a.type];
              const pct = totalValue > 0 ? (a.krwValue / totalValue) * 100 : 0;
              return (
                <div key={a.id}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span>
                      <span className="text-gray-300">{a.owner}</span>
                      <span className="text-gray-500"> · </span>
                      <span style={{ color: meta.color }}>{a.type}</span>
                      <span className="text-gray-500"> {a.broker}</span>
                    </span>
                    <span className="text-gray-300">₩{fmtM(a.krwValue)} <span className="text-gray-600">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 절세계좌 안내 */}
      {taxLimitRows.length > 0 && (
        <div className="bg-gray-900/40 border border-amber-500/20 p-4">
          <div className="text-amber-400 text-[10px] font-bold mb-3 tracking-wider">절세계좌 · 퇴직연금 요약</div>
          <div className="space-y-3">
            {taxLimitRows.map(row => (
              <div key={row.id} className="border-l-2 border-amber-500/40 pl-3">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[11px] text-gray-200">{row.owner} · <span style={{ color: row.meta.color }}>{row.type}</span> <span className="text-gray-500">({row.broker})</span></span>
                  <span className="text-[10px] text-gray-400">연 {((row.meta.annualLimitKrw || 0)).toLocaleString()}만원 한도</span>
                </div>
                {row.meta.taxBenefit && (
                  <div className="text-[10px] text-amber-300/80 mb-1">{row.meta.taxBenefit}</div>
                )}
                <div className="text-[10px] text-gray-500 space-y-0.5">
                  {row.meta.restrictions.map((r, i) => <div key={i}>⚠ {r}</div>)}
                </div>
                {row.meta.tips.slice(0, 2).map((t, i) => (
                  <div key={i} className="text-[10px] text-blue-300/70">💡 {t}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-gray-900/40 border border-gray-700 p-3">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/40 border border-gray-700 p-4">
      <div className="text-[10px] text-gray-400 font-bold mb-2 tracking-wider">{title}</div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div className="h-[200px] flex items-center justify-center text-gray-600 text-[11px]">자산 없음</div>;
}
