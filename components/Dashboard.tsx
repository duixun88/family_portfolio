'use client';

import React from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Account, Holding, AccountCategory } from '@/lib/types';
import { ACCOUNT_META, CATEGORY_COLOR } from '@/lib/accountMeta';

interface Props {
  accounts: Account[];
  holdings: Holding[];
  fxRate: number;
  getKrwValue: (h: Holding) => number;
  getKrwCost: (h: Holding) => number;
}

const OWNERS = ['태훈', '예솔', '태린'] as const;
const OWNER_COLORS = ['#f97316', '#3b82f6', '#10b981'];

const ASSET_COLORS: Record<string, string> = {
  stock: '#f97316', etf: '#fb923c', deposit: '#3b82f6',
  insurance: '#8b5cf6', cash: '#10b981', bond: '#06b6d4', fund: '#ec4899',
};
const ASSET_LABELS: Record<string, string> = {
  stock: '주식', etf: 'ETF', deposit: '예금',
  insurance: '보험', cash: '현금', bond: '채권', fund: '펀드',
};

const fmt = (n: number, d = 0) =>
  n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });

const fmtM = (n: number): string => {
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1e8) return `${s}${(abs / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${s}${Math.round(abs / 1e4).toLocaleString()}만`;
  return `${s}${fmt(abs)}`;
};

/* ── Tooltip ── */
const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 px-3 py-2 text-xs shadow-lg rounded-sm">
      <div className="font-bold text-slate-700 dark:text-gray-200">{d.name}</div>
      <div className="text-orange-500 dark:text-orange-300">₩{fmt(d.value)}</div>
      {d.payload?.pct != null && (
        <div className="text-slate-400 dark:text-gray-500">{d.payload.pct.toFixed(1)}%</div>
      )}
    </div>
  );
};

/* ── Donut + side legend ── */
function DonutChart({
  title, data, colors, total,
}: {
  title: string;
  data: { name: string; value: number; pct: number }[];
  colors: string[];
  total: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 p-4 h-full">
      <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-gray-500 mb-3">
        {title}
      </div>
      {data.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-slate-400 dark:text-gray-600 text-[11px]">
          자산 없음
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  cx="50%" cy="50%"
                  innerRadius={46} outerRadius={66}
                  startAngle={90} endAngle={-270}
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[12px] font-bold text-orange-500 dark:text-orange-300 leading-tight">
                ₩{fmtM(total)}
              </div>
              <div className="text-[9px] text-slate-400 dark:text-gray-500">총액</div>
            </div>
          </div>

          {/* Legend with mini progress bars */}
          <div className="flex-1 space-y-2.5 min-w-0">
            {data.map((d, i) => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ background: colors[i % colors.length] }}
                    />
                    <span className="text-[11px] text-slate-700 dark:text-gray-300 truncate">{d.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 flex-shrink-0 ml-1">
                    {d.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.pct}%`, background: colors[i % colors.length] }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-600 dark:text-gray-400 w-14 text-right flex-shrink-0">
                    ₩{fmtM(d.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Summary card ── */
function SCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 p-3">
      <div className="text-[10px] text-slate-400 dark:text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 dark:text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function Dashboard({ accounts, holdings, fxRate, getKrwValue, getKrwCost }: Props) {
  const totalValue = holdings.reduce((s, h) => s + getKrwValue(h), 0);
  const totalCost  = holdings.reduce((s, h) => s + getKrwCost(h), 0);
  const totalPnl   = totalValue - totalCost;
  const pnlPct     = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  /* 자산 유형별 */
  const byAssetType = Object.entries(
    holdings.reduce<Record<string, number>>((acc, h) => {
      acc[h.assetType] = (acc[h.assetType] || 0) + getKrwValue(h);
      return acc;
    }, {})
  )
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      key: k,
      name: ASSET_LABELS[k] || k,
      value: Math.round(v),
      pct: totalValue > 0 ? (v / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  /* 계좌 구분별 */
  const byCat = (['절세', '퇴직', '일반'] as AccountCategory[])
    .map(cat => {
      const ids = accounts.filter(a => ACCOUNT_META[a.type].category === cat).map(a => a.id);
      const v   = holdings.filter(h => ids.includes(h.accountId)).reduce((s, h) => s + getKrwValue(h), 0);
      return { name: cat, value: Math.round(v), pct: totalValue > 0 ? (v / totalValue) * 100 : 0 };
    })
    .filter(d => d.value > 0);

  /* 인원별 */
  const byOwner = OWNERS.map((owner, i) => {
    const ids   = accounts.filter(a => a.owner === owner).map(a => a.id);
    const value = holdings.filter(h => ids.includes(h.accountId)).reduce((s, h) => s + getKrwValue(h), 0);
    const cost  = holdings.filter(h => ids.includes(h.accountId)).reduce((s, h) => s + getKrwCost(h), 0);
    return { name: owner, value: Math.round(value), cost: Math.round(cost), pnl: Math.round(value - cost), color: OWNER_COLORS[i] };
  });

  /* 계좌별 */
  const byAccount = accounts
    .map(a => ({
      ...a,
      krwValue: holdings.filter(h => h.accountId === a.id).reduce((s, h) => s + getKrwValue(h), 0),
    }))
    .sort((a, b) => b.krwValue - a.krwValue);

  const taxAccounts = accounts.filter(a => ACCOUNT_META[a.type].annualLimitKrw);

  return (
    <div className="space-y-4">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SCard
          label="총 자산"
          value={`₩${fmtM(totalValue)}`}
          sub={`${fmt(totalValue)}원`}
          color="text-orange-500 dark:text-orange-300"
        />
        <SCard
          label="총 매입"
          value={`₩${fmtM(totalCost)}`}
          sub={`${accounts.length}개 계좌 · ${holdings.length}개 자산`}
          color="text-slate-700 dark:text-gray-300"
        />
        <SCard
          label="평가손익"
          value={`${totalPnl >= 0 ? '+' : ''}₩${fmtM(totalPnl)}`}
          sub={`${totalPnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
          color={totalPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}
        />
        <SCard
          label="환율"
          value={`${fxRate.toFixed(0)}원`}
          sub="USD/KRW"
          color="text-blue-600 dark:text-blue-300"
        />
      </div>

      {/* ── Donut charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChart
          title="자산 유형별"
          data={byAssetType}
          colors={byAssetType.map(d => ASSET_COLORS[d.key] || '#6b7280')}
          total={totalValue}
        />
        <DonutChart
          title="계좌 구분별 (절세 / 퇴직 / 일반)"
          data={byCat}
          colors={byCat.map(d => CATEGORY_COLOR[d.name as AccountCategory])}
          total={totalValue}
        />
      </div>

      {/* ── Owner bar + Account bars ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 인원별 */}
        <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 p-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-gray-500 mb-3">
            인원별 자산
          </div>
          {byOwner.every(o => o.value === 0) ? (
            <div className="h-36 flex items-center justify-center text-slate-400 dark:text-gray-600 text-[11px]">
              자산 없음
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={byOwner} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => [`₩${fmt(v)}`, '평가']}
                    contentStyle={{
                      background: 'var(--tw-bg-opacity, #fff)',
                      fontSize: 11,
                      borderRadius: 0,
                    }}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(v: number) => `₩${fmtM(v)}`}
                    />
                    {byOwner.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 space-y-1.5">
                {byOwner.map(o => (
                  <div key={o.name} className="grid grid-cols-4 text-[11px]">
                    <span style={{ color: o.color }} className="font-bold">{o.name}</span>
                    <span className="text-slate-600 dark:text-gray-300 text-right">₩{fmtM(o.value)}</span>
                    <span className={`text-right ${o.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {o.pnl >= 0 ? '+' : ''}₩{fmtM(o.pnl)}
                    </span>
                    <span className="text-slate-400 dark:text-gray-500 text-right text-[10px]">
                      {o.cost > 0 ? `${o.pnl >= 0 ? '+' : ''}${((o.pnl / o.cost) * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 계좌별 비중 */}
        <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 p-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-gray-500 mb-3">
            계좌별 자산 비중
          </div>
          {byAccount.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-slate-400 dark:text-gray-600 text-[11px]">
              계좌 없음
            </div>
          ) : (
            <div className="space-y-3">
              {byAccount.map(a => {
                const meta = ACCOUNT_META[a.type];
                const pct  = totalValue > 0 ? (a.krwValue / totalValue) * 100 : 0;
                return (
                  <div key={a.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span>
                        <span className="text-slate-500 dark:text-gray-400">{a.owner} · </span>
                        <span style={{ color: meta.color }} className="font-bold">{a.type}</span>
                        <span className="text-slate-400 dark:text-gray-600"> {a.broker}</span>
                      </span>
                      <span className="text-slate-600 dark:text-gray-300">
                        ₩{fmtM(a.krwValue)}{' '}
                        <span className="text-slate-400 dark:text-gray-600">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: meta.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 절세계좌 안내 ── */}
      {taxAccounts.length > 0 && (
        <div className="bg-amber-50 dark:bg-gray-900/40 border border-amber-200 dark:border-amber-500/20 p-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400 mb-3">
            절세계좌 · 퇴직연금 요약
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxAccounts.map(a => {
              const meta = ACCOUNT_META[a.type];
              return (
                <div key={a.id} className="border-l-2 border-amber-400 dark:border-amber-500/40 pl-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] text-slate-700 dark:text-gray-200">
                      {a.owner} · <span style={{ color: meta.color }}>{a.type}</span>
                      <span className="text-slate-400 dark:text-gray-500"> ({a.broker})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-400">
                      연 {(meta.annualLimitKrw || 0).toLocaleString()}만원
                    </span>
                  </div>
                  {meta.taxBenefit && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-300/80 mb-1">{meta.taxBenefit}</div>
                  )}
                  <div className="space-y-0.5">
                    {meta.restrictions.map((r, i) => (
                      <div key={i} className="text-[10px] text-red-500 dark:text-red-400/80">⚠ {r}</div>
                    ))}
                    {meta.tips.slice(0, 2).map((t, i) => (
                      <div key={i} className="text-[10px] text-blue-500 dark:text-blue-300/70">💡 {t}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
