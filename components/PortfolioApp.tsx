'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, RefreshCw, Download, Upload,
  Users, User, Wallet, Edit2, X,
  ChevronDown, ChevronRight, AlertCircle,
  TrendingUp, TrendingDown, BarChart2, Info,
  Sun, Moon, ArrowUp, ArrowDown, ArrowUpDown,
  Cloud, CloudOff,
} from 'lucide-react';
import { isCloudEnabled, loadFromCloud, saveToCloud } from '@/lib/sync';
import { Account, Holding, Owner, AccountType, AssetType, PriceMap, ActiveView } from '@/lib/types';
import { ACCOUNT_META } from '@/lib/accountMeta';
import { storage } from '@/lib/storage';
import Dashboard from './Dashboard';

// ── constants ──────────────────────────────────────────────────────────────────

const OWNERS: Owner[] = ['태훈', '예솔', '태린'];
const ACCOUNT_TYPES: AccountType[] = [
  'IRP', '연금저축', 'ISA', '퇴직연금DC', '퇴직연금DB', '일반', 'CMA', '예금계좌', '기타',
];
const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'stock',     label: '주식' },
  { value: 'etf',       label: 'ETF' },
  { value: 'deposit',   label: '예금' },
  { value: 'insurance', label: '보험' },
  { value: 'cash',      label: '현금' },
  { value: 'bond',      label: '채권' },
  { value: 'fund',      label: '펀드' },
];
const ASSET_BADGE: Record<string, string> = {
  stock:     'bg-orange-100  text-orange-600  dark:bg-orange-500/20  dark:text-orange-300',
  etf:       'bg-amber-100   text-amber-600   dark:bg-amber-500/20   dark:text-amber-300',
  deposit:   'bg-blue-100    text-blue-600    dark:bg-blue-500/20    dark:text-blue-300',
  insurance: 'bg-purple-100  text-purple-600  dark:bg-purple-500/20  dark:text-purple-300',
  cash:      'bg-green-100   text-green-600   dark:bg-green-500/20   dark:text-green-300',
  bond:      'bg-cyan-100    text-cyan-600    dark:bg-cyan-500/20    dark:text-cyan-300',
  fund:      'bg-pink-100    text-pink-600    dark:bg-pink-500/20    dark:text-pink-300',
};

// ── helpers ────────────────────────────────────────────────────────────────────

function detectMarket(ticker: string): { market: string; currency: string } {
  const t = ticker.toUpperCase();
  if (t.endsWith('.KS') || t.endsWith('.KQ')) return { market: 'KR', currency: 'KRW' };
  if (t.endsWith('.L'))  return { market: 'UK', currency: 'GBP' };
  if (t.endsWith('.T'))  return { market: 'JP', currency: 'JPY' };
  if (t.endsWith('.HK')) return { market: 'HK', currency: 'HKD' };
  return { market: 'US', currency: 'USD' };
}

const fmt = (n: number, d = 0) =>
  n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });

const pnlCls = (v: number) => v >= 0
  ? 'text-green-600 dark:text-green-400'
  : 'text-red-500 dark:text-red-400';

const sign = (v: number) => v >= 0 ? '+' : '';

const isMarketAsset = (t: AssetType) => t === 'stock' || t === 'etf';

// ── default form state ─────────────────────────────────────────────────────────

const defAccount = () => ({
  owner: '태훈' as Owner,
  type:  'IRP' as AccountType,
  broker: '',
  accountNumber: '',
  currency: 'KRW' as 'KRW' | 'USD' | 'MULTI',
  memo: '',
});

const defHolding = () => ({
  accountId: '',
  assetType: 'stock' as AssetType,
  name: '', ticker: '', quantity: '', avgPrice: '',
  principal: '', currentValue: '', maturityDate: '', interestRate: '', memo: '',
});

// ── component ──────────────────────────────────────────────────────────────────

export default function PortfolioApp() {
  const [loaded,   setLoaded]   = useState(false);
  const [isDark,   setIsDark]   = useState(true);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prices,   setPrices]   = useState<PriceMap>({});
  const [fxRate,   setFxRate]   = useState(1380);

  const [refreshing,  setRefreshing]  = useState(false);
  const [refreshLog,  setRefreshLog]  = useState<string[]>([]);
  const [activeView,  setActiveView]  = useState<ActiveView>({ type: 'all' });
  const [activeTab,   setActiveTab]   = useState<'dashboard' | 'holdings'>('dashboard');
  const [expandedOwners, setExpandedOwners] = useState<Record<string, boolean>>(
    Object.fromEntries(OWNERS.map(o => [o, true]))
  );
  const [statusMsg, setStatusMsg] = useState('');

  const [showAccountForm,  setShowAccountForm]  = useState(false);
  const [showHoldingForm,  setShowHoldingForm]  = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm,      setAccountForm]      = useState(defAccount());
  const [holdingForm,      setHoldingForm]      = useState(defHolding());
  const [infoAccountId,    setInfoAccountId]    = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Refs: always hold latest state for debounced cloud sync
  const syncTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingsRef   = useRef<Holding[]>([]);
  const accountsRef   = useRef<Account[]>([]);
  const pricesRef     = useRef<PriceMap>({});
  const fxRateRef     = useRef<number>(1380);

  // Keep refs in sync with state (runs on every render, before effects)
  holdingsRef.current = holdings;
  accountsRef.current = accounts;
  pricesRef.current   = prices;
  fxRateRef.current   = fxRate;

  // ── init ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // 1. localStorage에서 즉시 로드 (화면 빠르게 표시)
    const localH  = storage.loadHoldings();
    const localA  = storage.loadAccounts();
    const localP  = storage.loadPrices();
    const localFx = storage.loadFxRate();
    setHoldings(localH);
    setAccounts(localA);
    setPrices(localP);
    setFxRate(localFx);

    // 테마 로드
    const savedTheme = localStorage.getItem('fp:theme');
    const dark = savedTheme !== 'light';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    setLoaded(true);

    // 2. 클라우드에서 최신 데이터 로드 (백그라운드)
    if (isCloudEnabled) {
      setSyncStatus('syncing');
      loadFromCloud().then(cloudData => {
        if (cloudData) {
          setHoldings(cloudData.holdings);
          setAccounts(cloudData.accounts);
          if (cloudData.prices && Object.keys(cloudData.prices).length > 0) setPrices(cloudData.prices);
          if (cloudData.fxRate) setFxRate(cloudData.fxRate);
          // localStorage도 업데이트
          storage.saveHoldings(cloudData.holdings);
          storage.saveAccounts(cloudData.accounts);
          if (cloudData.prices) storage.savePrices(cloudData.prices);
          if (cloudData.fxRate) storage.saveFxRate(cloudData.fxRate);
          setSyncStatus('synced');
        } else {
          setSyncStatus('error');
        }
      });
    }
  }, []);

  // ── theme toggle ──────────────────────────────────────────────────────────────

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('fp:theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  // ── cloud sync (debounced 2s) ─────────────────────────────────────────────────

  const triggerCloudSync = useCallback(() => {
    if (!isCloudEnabled) return;
    setSyncStatus('syncing');
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const ok = await saveToCloud({
        holdings: holdingsRef.current,
        accounts: accountsRef.current,
        prices:   pricesRef.current,
        fxRate:   fxRateRef.current,
      });
      setSyncStatus(ok ? 'synced' : 'error');
    }, 2000);
  }, []);

  // ── save helpers ──────────────────────────────────────────────────────────────

  const saveHoldings = useCallback((next: Holding[]) => {
    holdingsRef.current = next;
    setHoldings(next); storage.saveHoldings(next);
    triggerCloudSync();
  }, [triggerCloudSync]);

  const saveAccounts = useCallback((next: Account[]) => {
    accountsRef.current = next;
    setAccounts(next); storage.saveAccounts(next);
    triggerCloudSync();
  }, [triggerCloudSync]);

  // ── value calc ────────────────────────────────────────────────────────────────

  const getKrwValue = useCallback((h: Holding): number => {
    if (isMarketAsset(h.assetType)) {
      const p = prices[h.ticker || '']?.price || 0;
      const local = p * (h.quantity || 0);
      return h.tradeCurrency === 'USD' ? local * fxRate : local;
    }
    return h.currentValue ?? h.principal ?? 0;
  }, [prices, fxRate]);

  const getKrwCost = useCallback((h: Holding): number => {
    if (isMarketAsset(h.assetType)) {
      const local = (h.avgPrice || 0) * (h.quantity || 0);
      return h.tradeCurrency === 'USD' ? local * fxRate : local;
    }
    return h.principal ?? 0;
  }, [fxRate]);

  // ── price refresh ─────────────────────────────────────────────────────────────

  const refreshPrices = useCallback(async () => {
    setRefreshing(true);
    const tickers = [...new Set(
      holdings
        .filter(h => isMarketAsset(h.assetType))
        .map(h => h.ticker!)
        .filter(Boolean)
    )];
    if (!tickers.length) {
      setRefreshLog(['조회할 주식/ETF 종목 없음']);
      setRefreshing(false);
      return;
    }
    setRefreshLog([`조회: ${tickers.join(', ')}`, '데이터 수신 중...']);
    try {
      const res  = await fetch(`/api/prices?tickers=${encodeURIComponent(tickers.join(','))}`);
      const data = await res.json();
      const newPrices = { ...prices };
      const log: string[] = [];
      for (const ticker of tickers) {
        const d = data.prices?.[ticker];
        if (d?.price) {
          newPrices[ticker] = { ...d, ts: Date.now() };
          const nameStr = d.name && d.name !== ticker ? ` (${d.name})` : '';
          log.push(`✓ ${ticker}${nameStr}: ${d.price.toLocaleString()} ${d.currency} (${d.date})`);
        } else {
          log.push(`✗ ${ticker}: 조회 실패`);
        }
      }
      if (data.usdkrw) {
        setFxRate(data.usdkrw);
        storage.saveFxRate(data.usdkrw);
        log.push(`USD/KRW: ${data.usdkrw.toFixed(2)}`);
      }
      log.push(`완료 ${new Date().toLocaleTimeString('ko-KR')}`);
      pricesRef.current = newPrices;
      setPrices(newPrices);
      storage.savePrices(newPrices);
      setRefreshLog(log);
      triggerCloudSync();
    } catch (e: any) {
      setRefreshLog([`오류: ${e.message}`]);
    }
    setRefreshing(false);
  }, [holdings, prices, triggerCloudSync]);

  // ── account CRUD ──────────────────────────────────────────────────────────────

  const submitAccountForm = useCallback(() => {
    if (!accountForm.broker) { setStatusMsg('증권사/기관 입력 필수'); return; }
    if (editingAccountId) {
      saveAccounts(accounts.map(a => a.id === editingAccountId ? { ...a, ...accountForm } : a));
      setEditingAccountId(null);
    } else {
      saveAccounts([...accounts, {
        id: `acc_${Date.now()}`, ...accountForm, createdAt: new Date().toISOString(),
      }]);
    }
    setShowAccountForm(false);
    setAccountForm(defAccount());
  }, [accountForm, editingAccountId, accounts, saveAccounts]);

  const startEditAccount = useCallback((acc: Account) => {
    setAccountForm({
      owner: acc.owner, type: acc.type, broker: acc.broker,
      accountNumber: acc.accountNumber || '', currency: acc.currency, memo: acc.memo || '',
    });
    setEditingAccountId(acc.id);
    setShowAccountForm(true);
  }, []);

  const deleteAccount = useCallback((id: string) => {
    const linked = holdings.filter(h => h.accountId === id);
    if (!confirm(linked.length ? `계좌 내 ${linked.length}개 자산도 삭제됩니다. 계속?` : '계좌를 삭제하시겠습니까?')) return;
    if (linked.length) saveHoldings(holdings.filter(h => h.accountId !== id));
    saveAccounts(accounts.filter(a => a.id !== id));
    if (activeView.type === 'account' && activeView.accountId === id) setActiveView({ type: 'all' });
  }, [holdings, accounts, activeView, saveHoldings, saveAccounts]);

  // ── holding CRUD ──────────────────────────────────────────────────────────────

  const submitHoldingForm = useCallback(() => {
    if (!holdingForm.accountId) { setStatusMsg('계좌 선택 필수'); return; }
    const isM = isMarketAsset(holdingForm.assetType);
    if (isM && (!holdingForm.ticker || !holdingForm.quantity || !holdingForm.avgPrice)) {
      setStatusMsg('티커/수량/매입단가 필수'); return;
    }
    if (!isM && !holdingForm.name) { setStatusMsg('자산명 입력 필수'); return; }

    const { market, currency } = isM
      ? detectMarket(holdingForm.ticker)
      : { market: 'KR', currency: 'KRW' };

    const newH: Holding = {
      id: `h_${Date.now()}`,
      accountId: holdingForm.accountId,
      assetType: holdingForm.assetType,
      name: isM ? holdingForm.ticker.toUpperCase() : holdingForm.name,
      addedAt: new Date().toISOString(),
      memo: holdingForm.memo || undefined,
      ...(isM ? {
        ticker: holdingForm.ticker.toUpperCase(), market, tradeCurrency: currency,
        quantity: parseFloat(holdingForm.quantity),
        avgPrice: parseFloat(holdingForm.avgPrice),
      } : {
        principal:    holdingForm.principal    ? parseFloat(holdingForm.principal)    : undefined,
        currentValue: holdingForm.currentValue ? parseFloat(holdingForm.currentValue) : undefined,
        maturityDate: holdingForm.maturityDate || undefined,
        interestRate: holdingForm.interestRate ? parseFloat(holdingForm.interestRate) : undefined,
      }),
    };
    saveHoldings([...holdings, newH]);
    setHoldingForm(f => ({ ...defHolding(), accountId: f.accountId, assetType: f.assetType }));
    setShowHoldingForm(false);
  }, [holdingForm, holdings, saveHoldings]);

  const deleteHolding = useCallback((id: string) => {
    if (!confirm('이 자산을 삭제하시겠습니까?')) return;
    saveHoldings(holdings.filter(h => h.id !== id));
  }, [holdings, saveHoldings]);

  const updateHolding = useCallback((id: string, field: string, val: string) => {
    saveHoldings(holdings.map(h =>
      h.id === id
        ? { ...h, [field]: (field === 'memo' || field === 'maturityDate') ? val : (parseFloat(val) || 0) }
        : h
    ));
  }, [holdings, saveHoldings]);

  // ── export / import ───────────────────────────────────────────────────────────

  const exportJSON = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ holdings, accounts, prices, fxRate, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `portfolio_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [holdings, accounts, prices, fxRate]);

  const importJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target!.result as string);
        if (d.holdings) saveHoldings(d.holdings);
        if (d.accounts) saveAccounts(d.accounts);
        if (d.prices)   { setPrices(d.prices); storage.savePrices(d.prices); }
        if (d.fxRate)   { fxRateRef.current = d.fxRate; setFxRate(d.fxRate); storage.saveFxRate(d.fxRate); }
        setStatusMsg('가져오기 완료');
        setTimeout(() => setStatusMsg(''), 3000);
        triggerCloudSync();
      } catch { setStatusMsg('파일 형식 오류'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [saveHoldings, saveAccounts, triggerCloudSync]);

  // ── computed ──────────────────────────────────────────────────────────────────

  const getAccount = useCallback((id: string) => accounts.find(a => a.id === id), [accounts]);

  const filteredHoldings = useMemo(() => {
    if (activeView.type === 'all') return holdings;
    if (activeView.type === 'owner') {
      const ids = accounts.filter(a => a.owner === activeView.owner).map(a => a.id);
      return holdings.filter(h => ids.includes(h.accountId));
    }
    return holdings.filter(h => h.accountId === activeView.accountId);
  }, [holdings, accounts, activeView]);

  const accountSummary = useMemo(() => accounts.map(a => {
    const items    = holdings.filter(h => h.accountId === a.id);
    const krwValue = items.reduce((s, h) => s + getKrwValue(h), 0);
    const krwCost  = items.reduce((s, h) => s + getKrwCost(h), 0);
    return { ...a, krwValue, krwCost, pnl: krwValue - krwCost, count: items.length };
  }), [accounts, holdings, getKrwValue, getKrwCost]);

  const ownerSummary = useMemo(() => OWNERS.map(owner => {
    const accs = accountSummary.filter(a => a.owner === owner);
    return {
      owner,
      krwValue: accs.reduce((s, a) => s + a.krwValue, 0),
      pnl:      accs.reduce((s, a) => s + a.pnl, 0),
      accounts: accs,
    };
  }), [accountSummary]);

  const summary = useMemo(() => {
    const cost  = filteredHoldings.reduce((s, h) => s + getKrwCost(h), 0);
    const value = filteredHoldings.reduce((s, h) => s + getKrwValue(h), 0);
    return { cost, value, pnl: value - cost };
  }, [filteredHoldings, getKrwValue, getKrwCost]);

  // ── render guard ──────────────────────────────────────────────────────────────

  if (!loaded) return (
    <div className="min-h-screen bg-slate-100 dark:bg-black text-orange-500 dark:text-orange-400 flex items-center justify-center font-mono text-sm">
      Loading...
    </div>
  );

  const infoAcc  = infoAccountId ? accounts.find(a => a.id === infoAccountId) : null;
  const infoMeta = infoAcc ? ACCOUNT_META[infoAcc.type] : null;

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-black text-slate-800 dark:text-gray-200 font-mono text-xs flex flex-col">

      {/* ── Header ── */}
      <div className="border-b border-orange-400/40 dark:border-orange-500/30 bg-white dark:bg-black px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-orange-500 dark:text-orange-400 tracking-wider">FAMILY PORTFOLIO</h1>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-gray-600">
            <span>v4.2 · Yahoo Finance · {new Date().toLocaleString('ko-KR')}</span>
            {isCloudEnabled && (
              <span className={`flex items-center gap-1 ${
                syncStatus === 'synced'  ? 'text-green-500 dark:text-green-400' :
                syncStatus === 'error'   ? 'text-red-500 dark:text-red-400' :
                syncStatus === 'syncing' ? 'text-orange-500 dark:text-orange-400' :
                'text-slate-300 dark:text-gray-700'
              }`}>
                {syncStatus === 'error'
                  ? <CloudOff size={10} />
                  : <Cloud size={10} className={syncStatus === 'syncing' ? 'animate-pulse' : ''} />}
                {syncStatus === 'syncing' ? '동기화 중' :
                 syncStatus === 'synced'  ? '동기화 완료' :
                 syncStatus === 'error'   ? '동기화 오류' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={toggleTheme}
            className="px-3 py-1.5 bg-slate-100 dark:bg-gray-700/40 border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 flex items-center gap-1"
          >
            {isDark ? <Sun size={10} /> : <Moon size={10} />}
            {isDark ? 'LIGHT' : 'DARK'}
          </button>
          <button
            onClick={refreshPrices} disabled={refreshing}
            className="px-3 py-1.5 bg-orange-50 dark:bg-orange-500/20 hover:bg-orange-100 dark:hover:bg-orange-500/30 border border-orange-300 dark:border-orange-500/50 text-orange-600 dark:text-orange-300 flex items-center gap-1 disabled:opacity-40"
          >
            <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} /> REFRESH
          </button>
          <button
            onClick={() => { setShowAccountForm(v => !v); setEditingAccountId(null); setAccountForm(defAccount()); }}
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-300 dark:border-blue-500/50 text-blue-600 dark:text-blue-300 flex items-center gap-1"
          >
            <Wallet size={10} /> 계좌
          </button>
          <button
            onClick={() => setShowHoldingForm(v => !v)}
            disabled={accounts.length === 0}
            className="px-3 py-1.5 bg-green-50 dark:bg-green-600/20 hover:bg-green-100 dark:hover:bg-green-600/30 border border-green-300 dark:border-green-500/50 text-green-600 dark:text-green-300 flex items-center gap-1 disabled:opacity-30"
          >
            <Plus size={10} /> 자산
          </button>
          <button
            onClick={exportJSON}
            className="px-3 py-1.5 bg-slate-100 dark:bg-gray-700/40 border border-slate-300 dark:border-gray-600 text-slate-500 dark:text-gray-400 flex items-center gap-1"
          >
            <Download size={10} />
          </button>
          <label className="px-3 py-1.5 bg-slate-100 dark:bg-gray-700/40 border border-slate-300 dark:border-gray-600 text-slate-500 dark:text-gray-400 flex items-center gap-1 cursor-pointer">
            <Upload size={10} />
            <input type="file" accept=".json" onChange={importJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* ── Status ── */}
      {statusMsg && (
        <div className="bg-yellow-50 dark:bg-yellow-400/10 border-b border-yellow-300 dark:border-yellow-500/30 px-4 py-1.5 text-yellow-700 dark:text-yellow-300 text-[11px]">
          {statusMsg}
        </div>
      )}

      {/* ── Refresh log ── */}
      {refreshLog.length > 0 && (
        <div className="bg-slate-50 dark:bg-gray-900/80 border-b border-slate-200 dark:border-gray-800 px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400 dark:text-gray-500">시세 조회 로그</span>
            <button onClick={() => setRefreshLog([])} className="text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-300">
              <X size={10} />
            </button>
          </div>
          {refreshLog.map((l, i) => (
            <div key={i} className={`text-[10px] ${
              l.startsWith('✓') ? 'text-green-600 dark:text-green-400' :
              l.startsWith('✗') ? 'text-red-500 dark:text-red-400' :
              l.startsWith('USD') ? 'text-blue-500 dark:text-blue-300' :
              l.startsWith('완료') ? 'text-orange-500 dark:text-orange-300' :
              'text-slate-500 dark:text-gray-400'
            }`}>{l}</div>
          ))}
        </div>
      )}

      {/* ── Account Form ── */}
      {showAccountForm && (
        <div className="border-b border-blue-300/50 dark:border-blue-500/30 bg-blue-50/50 dark:bg-gray-950 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-600 dark:text-blue-300 font-bold">
              {editingAccountId ? '계좌 수정' : '계좌 등록'}
            </span>
            <button onClick={() => { setShowAccountForm(false); setEditingAccountId(null); }}
              className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
            {[
              <select key="owner" value={accountForm.owner}
                onChange={e => setAccountForm({ ...accountForm, owner: e.target.value as Owner })}
                className="input-field">
                {OWNERS.map(o => <option key={o}>{o}</option>)}
              </select>,
              <select key="type" value={accountForm.type}
                onChange={e => setAccountForm({ ...accountForm, type: e.target.value as AccountType })}
                className="input-field col-span-2">
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>,
              <input key="broker" placeholder="증권사/기관 *" value={accountForm.broker}
                onChange={e => setAccountForm({ ...accountForm, broker: e.target.value })}
                className="input-field" />,
              <input key="accnum" placeholder="계좌번호" value={accountForm.accountNumber}
                onChange={e => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                className="input-field" />,
              <select key="ccy" value={accountForm.currency}
                onChange={e => setAccountForm({ ...accountForm, currency: e.target.value as 'KRW' | 'USD' | 'MULTI' })}
                className="input-field">
                <option>KRW</option><option>USD</option><option>MULTI</option>
              </select>,
            ]}
          </div>
          <div className="flex gap-2">
            <textarea placeholder="메모: 절세포인트, 납입한도, 인출조건..." value={accountForm.memo}
              onChange={e => setAccountForm({ ...accountForm, memo: e.target.value })}
              rows={2}
              className="input-field flex-1 resize-none text-[11px]" />
            <button onClick={submitAccountForm}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-5 text-xs">
              {editingAccountId ? '수정' : '저장'}
            </button>
          </div>
          {accountForm.type && ACCOUNT_META[accountForm.type]?.taxBenefit && (
            <div className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-300/80">
              {ACCOUNT_META[accountForm.type].taxBenefit}
            </div>
          )}
        </div>
      )}

      {/* ── Holding Form ── */}
      {showHoldingForm && (
        <div className="border-b border-green-300/50 dark:border-green-500/30 bg-green-50/30 dark:bg-gray-950 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-600 dark:text-green-300 font-bold">자산 등록</span>
            <button onClick={() => setShowHoldingForm(false)}
              className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
            <select value={holdingForm.accountId}
              onChange={e => setHoldingForm({ ...holdingForm, accountId: e.target.value })}
              className="input-field col-span-2">
              <option value="">계좌 선택 *</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.owner} · {a.type} ({a.broker})</option>)}
            </select>
            <select value={holdingForm.assetType}
              onChange={e => setHoldingForm({ ...holdingForm, assetType: e.target.value as AssetType })}
              className="input-field">
              {ASSET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {isMarketAsset(holdingForm.assetType) ? (
              <>
                <input placeholder="티커 (AAPL, 005930.KS) *" value={holdingForm.ticker}
                  onChange={e => setHoldingForm({ ...holdingForm, ticker: e.target.value })}
                  className="input-field" />
                <input type="number" placeholder="수량 *" value={holdingForm.quantity}
                  onChange={e => setHoldingForm({ ...holdingForm, quantity: e.target.value })}
                  className="input-field" />
                <input type="number" placeholder="매입단가 *" step="0.01" value={holdingForm.avgPrice}
                  onChange={e => setHoldingForm({ ...holdingForm, avgPrice: e.target.value })}
                  className="input-field" />
              </>
            ) : (
              <>
                <input placeholder="자산명 *" value={holdingForm.name}
                  onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })}
                  className="input-field" />
                <input type="number" placeholder="원금 (₩)" value={holdingForm.principal}
                  onChange={e => setHoldingForm({ ...holdingForm, principal: e.target.value })}
                  className="input-field" />
                <input type="number" placeholder="현재가치 (₩)" value={holdingForm.currentValue}
                  onChange={e => setHoldingForm({ ...holdingForm, currentValue: e.target.value })}
                  className="input-field" />
              </>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {!isMarketAsset(holdingForm.assetType) && (
              <>
                <input type="date" value={holdingForm.maturityDate}
                  onChange={e => setHoldingForm({ ...holdingForm, maturityDate: e.target.value })}
                  className="input-field" />
                <input type="number" placeholder="금리 (%)" step="0.01" value={holdingForm.interestRate}
                  onChange={e => setHoldingForm({ ...holdingForm, interestRate: e.target.value })}
                  className="input-field" />
              </>
            )}
            <input placeholder="메모" value={holdingForm.memo}
              onChange={e => setHoldingForm({ ...holdingForm, memo: e.target.value })}
              className="input-field col-span-2" />
            <button onClick={submitHoldingForm}
              className="bg-green-500 hover:bg-green-400 text-white font-bold px-4 text-xs col-span-2 md:col-span-1">
              저장
            </button>
          </div>
        </div>
      )}

      {/* ── Info Modal ── */}
      {infoAcc && infoMeta && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setInfoAccountId(null)}>
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-600 p-5 max-w-md w-full shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-bold" style={{ color: infoMeta.color }}>{infoAcc.type}</div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400">{infoMeta.label}</div>
              </div>
              <button onClick={() => setInfoAccountId(null)}
                className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
            {infoMeta.taxBenefit && (
              <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">
                {infoMeta.taxBenefit}
              </div>
            )}
            {infoMeta.restrictions.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-slate-400 dark:text-gray-500 mb-1">제한사항</div>
                {infoMeta.restrictions.map((r, i) => (
                  <div key={i} className="text-[11px] text-red-500 dark:text-red-400">⚠ {r}</div>
                ))}
              </div>
            )}
            {infoMeta.tips.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-slate-400 dark:text-gray-500 mb-1">절세 팁</div>
                {infoMeta.tips.map((t, i) => (
                  <div key={i} className="text-[11px] text-blue-500 dark:text-blue-300">💡 {t}</div>
                ))}
              </div>
            )}
            {infoAcc.memo && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-700 text-[11px] text-slate-600 dark:text-yellow-200/80 whitespace-pre-wrap">
                {infoAcc.memo}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <div className="w-60 border-r border-slate-200 dark:border-gray-800 overflow-y-auto flex-shrink-0 bg-slate-50 dark:bg-gray-950/50">
          {/* 전체 */}
          <div
            onClick={() => setActiveView({ type: 'all' })}
            className={`p-3 cursor-pointer border-b border-slate-200 dark:border-gray-800 border-l-2 ${
              activeView.type === 'all'
                ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-500/10'
                : 'border-l-transparent hover:bg-slate-100 dark:hover:bg-gray-800/30'
            }`}
          >
            <div className="flex items-center gap-1 text-slate-500 dark:text-gray-400 mb-1">
              <Users size={10} /> 전체 통합
            </div>
            <div className="text-base font-bold text-orange-500 dark:text-orange-300">
              ₩{ownerSummary.reduce((s, o) => s + o.krwValue, 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
            </div>
            <div className={`text-[10px] ${pnlCls(ownerSummary.reduce((s, o) => s + o.pnl, 0))}`}>
              {sign(ownerSummary.reduce((s, o) => s + o.pnl, 0))}
              ₩{fmt(ownerSummary.reduce((s, o) => s + o.pnl, 0))}
            </div>
          </div>

          {/* 인원별 그룹 */}
          {ownerSummary.map(o => (
            <div key={o.owner} className="border-b border-slate-200 dark:border-gray-800">
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-800/30"
                onClick={() => setExpandedOwners(prev => ({ ...prev, [o.owner]: !prev[o.owner] }))}
              >
                <div className="flex items-center gap-1.5">
                  {expandedOwners[o.owner] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <User size={10} className="text-slate-400 dark:text-gray-500" />
                  <span className="text-slate-700 dark:text-gray-200">{o.owner}</span>
                  <span className="text-slate-400 dark:text-gray-600 text-[9px]">({o.accounts.length})</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setActiveView({ type: 'owner', owner: o.owner }); }}
                  className={`text-[9px] px-1.5 py-0.5 ${
                    activeView.type === 'owner' && activeView.owner === o.owner
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-200 dark:bg-gray-700/50 text-slate-500 dark:text-gray-400 hover:bg-slate-300 dark:hover:bg-gray-600/50'
                  }`}
                >
                  VIEW
                </button>
              </div>
              <div className="px-3 pb-1.5 flex justify-between text-[10px]">
                <span className="text-slate-500 dark:text-gray-400">₩{fmt(o.krwValue)}</span>
                <span className={pnlCls(o.pnl)}>{sign(o.pnl)}₩{fmt(o.pnl)}</span>
              </div>

              {expandedOwners[o.owner] && (
                <div>
                  {o.accounts.length === 0 && (
                    <div className="text-[10px] text-slate-400 dark:text-gray-600 px-4 py-2 italic">계좌 없음</div>
                  )}
                  {o.accounts.map(a => {
                    const meta     = ACCOUNT_META[a.type];
                    const isActive = activeView.type === 'account' && activeView.accountId === a.id;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setActiveView({ type: 'account', accountId: a.id })}
                        className={`px-3 py-2 cursor-pointer border-l-2 hover:bg-slate-100 dark:hover:bg-gray-800/30 ${
                          isActive
                            ? 'border-orange-500 bg-orange-50 dark:bg-gray-800/40'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold truncate max-w-[90px] text-[10px]"
                            style={{ color: meta.color }}>
                            {a.type}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={e => { e.stopPropagation(); setInfoAccountId(a.id); }}
                              className="text-slate-400 dark:text-gray-600 hover:text-amber-500"><Info size={9} /></button>
                            <button onClick={e => { e.stopPropagation(); startEditAccount(a); }}
                              className="text-slate-400 dark:text-gray-600 hover:text-blue-500"><Edit2 size={9} /></button>
                            <button onClick={e => { e.stopPropagation(); deleteAccount(a.id); }}
                              className="text-slate-400 dark:text-gray-600 hover:text-red-500"><Trash2 size={9} /></button>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-gray-600 truncate">
                          {a.broker}{a.accountNumber ? ` · ${a.accountNumber}` : ''}
                        </div>
                        <div className="flex justify-between text-[10px] mt-0.5">
                          <span className="text-slate-500 dark:text-gray-400">
                            ₩{fmt(a.krwValue)} <span className="text-slate-400 dark:text-gray-600">({a.count})</span>
                          </span>
                          <span className={pnlCls(a.pnl)}>
                            {a.krwCost > 0 ? `${sign(a.pnl)}${((a.pnl / a.krwCost) * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Main ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Tab bar */}
          <div className="border-b border-slate-200 dark:border-gray-800 flex items-center px-4 gap-4 bg-white dark:bg-gray-950/30">
            {(['dashboard', 'holdings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2.5 text-[11px] border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-orange-500 text-orange-500 dark:text-orange-300'
                    : 'border-transparent text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'dashboard'
                  ? <span className="flex items-center gap-1"><BarChart2 size={10} /> 대시보드</span>
                  : <span className="flex items-center gap-1"><TrendingUp size={10} /> 보유내역</span>}
              </button>
            ))}
            <div className="ml-auto text-[10px] text-slate-400 dark:text-gray-600">
              USD/KRW {fxRate.toFixed(2)} · {accounts.length}계좌 · {holdings.length}자산
            </div>
          </div>

          <div className="p-4">
            {activeTab === 'dashboard' ? (
              <Dashboard
                accounts={accounts}
                holdings={holdings}
                fxRate={fxRate}
                getKrwValue={getKrwValue}
                getKrwCost={getKrwCost}
              />
            ) : (
              <HoldingsView
                holdings={filteredHoldings}
                accounts={accounts}
                prices={prices}
                fxRate={fxRate}
                getAccount={getAccount}
                getKrwValue={getKrwValue}
                getKrwCost={getKrwCost}
                activeView={activeView}
                summary={summary}
                updateHolding={updateHolding}
                deleteHolding={deleteHolding}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-black px-4 py-1.5 flex justify-between text-[9px] text-slate-400 dark:text-gray-700 flex-shrink-0">
        <span>시세: Yahoo Finance (15~20분 지연)</span>
        <span>저장: localStorage · JSON 백업 권장</span>
      </div>

      {/* Tailwind: preload input-field utility */}
      <style>{`
        .input-field {
          background: white;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          padding: 6px 8px;
          font-family: inherit;
          font-size: 12px;
          width: 100%;
          outline: none;
        }
        .dark .input-field {
          background: #000;
          border-color: #374151;
          color: #e5e7eb;
        }
        .input-field:focus {
          border-color: #f97316;
        }
      `}</style>
    </div>
  );
}

// ── Holdings View ─────────────────────────────────────────────────────────────

type SortKey = 'default' | 'value' | 'pnlPct' | 'pnl';

interface HoldingsViewProps {
  holdings:      Holding[];
  accounts:      Account[];
  prices:        PriceMap;
  fxRate:        number;
  getAccount:    (id: string) => Account | undefined;
  getKrwValue:   (h: Holding) => number;
  getKrwCost:    (h: Holding) => number;
  activeView:    ActiveView;
  summary:       { cost: number; value: number; pnl: number };
  updateHolding: (id: string, field: string, val: string) => void;
  deleteHolding: (id: string) => void;
}

function HoldingsView({
  holdings, accounts, prices, getAccount,
  getKrwValue, getKrwCost, activeView, summary,
  updateHolding, deleteHolding,
}: HoldingsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedHoldings = useMemo(() => {
    if (sortKey === 'default') return holdings;
    return [...holdings].sort((a, b) => {
      let va = 0, vb = 0;
      if (sortKey === 'value') {
        va = getKrwValue(a); vb = getKrwValue(b);
      } else if (sortKey === 'pnlPct') {
        const ca = getKrwCost(a), va_ = getKrwValue(a);
        const cb = getKrwCost(b), vb_ = getKrwValue(b);
        va = ca > 0 ? ((va_ - ca) / ca) * 100 : 0;
        vb = cb > 0 ? ((vb_ - cb) / cb) * 100 : 0;
      } else { // pnl
        va = getKrwValue(a) - getKrwCost(a);
        vb = getKrwValue(b) - getKrwCost(b);
      }
      return sortAsc ? va - vb : vb - va;
    });
  }, [holdings, sortKey, sortAsc, getKrwValue, getKrwCost]);

  const summaryPct = summary.cost > 0 ? (summary.pnl / summary.cost) * 100 : 0;
  const selAcc     = activeView.type === 'account' ? accounts.find(a => a.id === activeView.accountId) : null;

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={8} className="text-slate-400 dark:text-gray-600" />;
    return sortAsc
      ? <ArrowUp   size={8} className="text-orange-500 dark:text-orange-400" />
      : <ArrowDown size={8} className="text-orange-500 dark:text-orange-400" />;
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-orange-500 dark:text-orange-400 font-bold text-[11px]">
            {activeView.type === 'all'     ? '전체 통합'          :
             activeView.type === 'owner'   ? `${activeView.owner} 전체` :
             selAcc ? `${selAcc.type} · ${selAcc.broker}` : ''}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-gray-600">{holdings.length}개 자산</span>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div>
            <span className="text-slate-400 dark:text-gray-500">총매입</span>
            <span className="text-slate-700 dark:text-gray-200 ml-1">₩{fmt(summary.cost)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-gray-500">평가금액</span>
            <span className="text-orange-500 dark:text-orange-300 ml-1">₩{fmt(summary.value)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-gray-500">평가손익</span>
            <span className={`ml-1 font-bold ${pnlCls(summary.pnl)}`}>
              {sign(summary.pnl)}₩{fmt(summary.pnl)} ({sign(summaryPct)}{summaryPct.toFixed(2)}%)
            </span>
          </div>
        </div>
        {selAcc?.memo && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-gray-800 text-[11px] text-amber-600 dark:text-yellow-200/80 whitespace-pre-wrap">
            {selAcc.memo}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-gray-800/60 border-b border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-500">
            <tr>
              {activeView.type !== 'account' && <th className="px-2 py-2 text-left text-[10px]">계좌</th>}
              <th className="px-2 py-2 text-left text-[10px]">종목/자산</th>
              <th className="px-2 py-2 text-left text-[10px]">구분</th>
              <th className="px-2 py-2 text-right text-[10px]">수량/원금</th>
              <th className="px-2 py-2 text-right text-[10px]">매입가/금리</th>
              <th className="px-2 py-2 text-right text-[10px]">현재가/평가</th>
              {/* Sortable: 평가(₩) */}
              <th
                className="px-2 py-2 text-right text-[10px] cursor-pointer hover:text-slate-700 dark:hover:text-gray-300 select-none"
                onClick={() => handleSort('value')}
              >
                <span className="flex items-center justify-end gap-1">
                  평가(₩) <SortIcon k="value" />
                </span>
              </th>
              {/* Sortable: 손익(₩) */}
              <th
                className="px-2 py-2 text-right text-[10px] cursor-pointer hover:text-slate-700 dark:hover:text-gray-300 select-none"
                onClick={() => handleSort('pnl')}
              >
                <span className="flex items-center justify-end gap-1">
                  손익(₩) <SortIcon k="pnl" />
                </span>
              </th>
              {/* Sortable: 손익률 */}
              <th
                className="px-2 py-2 text-right text-[10px] cursor-pointer hover:text-slate-700 dark:hover:text-gray-300 select-none"
                onClick={() => handleSort('pnlPct')}
              >
                <span className="flex items-center justify-end gap-1">
                  손익률 <SortIcon k="pnlPct" />
                </span>
              </th>
              <th className="px-2 py-2 text-left text-[10px]">메모</th>
              <th className="px-2 py-2 text-[10px]"></th>
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-16 text-slate-400 dark:text-gray-600">
                  {accounts.length === 0
                    ? '먼저 [계좌] 버튼으로 계좌를 등록하세요.'
                    : '[자산] 버튼으로 자산을 추가하세요.'}
                </td>
              </tr>
            )}
            {sortedHoldings.map(h => {
              const acc        = getAccount(h.accountId);
              const isM        = isMarketAsset(h.assetType);
              const priceData  = isM ? prices[h.ticker || ''] : null;
              const krwValue   = getKrwValue(h);
              const krwCost    = getKrwCost(h);
              const pnl        = krwValue - krwCost;
              const pnlPct     = krwCost > 0 ? (pnl / krwCost) * 100 : 0;
              const hasPrice   = isM && priceData?.price;
              const isKrw      = h.tradeCurrency === 'KRW' || !isM;
              const accMeta    = acc ? ACCOUNT_META[acc.type] : null;
              const stockName  = isM && priceData?.name && priceData.name !== h.ticker
                ? priceData.name : null;
              const showPnl    = !isM || hasPrice;

              return (
                <tr key={h.id} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/20">
                  {activeView.type !== 'account' && (
                    <td className="px-2 py-1.5">
                      <div className="text-[10px] font-bold" style={{ color: accMeta?.color || '#64748b' }}>
                        {acc?.type || '?'}
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-gray-600">{acc?.owner}</div>
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    <div className="font-bold text-orange-500 dark:text-orange-300">{h.name}</div>
                    {stockName && <div className="text-[9px] text-slate-400 dark:text-gray-500 truncate max-w-[120px]">{stockName}</div>}
                    {h.maturityDate && <div className="text-[9px] text-slate-400 dark:text-gray-600">만기 {h.maturityDate}</div>}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-sm ${ASSET_BADGE[h.assetType] || 'bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {ASSET_TYPE_OPTIONS.find(o => o.value === h.assetType)?.label || h.assetType}
                    </span>
                    {isM && <div className="text-[9px] text-slate-400 dark:text-gray-600 mt-0.5">{h.tradeCurrency}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {isM ? (
                      <input type="number" value={h.quantity || ''}
                        onChange={e => updateHolding(h.id, 'quantity', e.target.value)}
                        className="w-20 bg-transparent text-right text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 px-1" />
                    ) : (
                      <div>
                        <input type="number" value={h.principal || ''}
                          onChange={e => updateHolding(h.id, 'principal', e.target.value)}
                          className="w-24 bg-transparent text-right text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 px-1" />
                        <div className="text-[9px] text-slate-400 dark:text-gray-600">원금</div>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {isM ? (
                      <input type="number" value={h.avgPrice || ''} step="0.01"
                        onChange={e => updateHolding(h.id, 'avgPrice', e.target.value)}
                        className="w-24 bg-transparent text-right text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 px-1" />
                    ) : h.interestRate ? (
                      <div>
                        <span className="text-blue-500 dark:text-blue-300">{h.interestRate}%</span>
                        <div className="text-[9px] text-slate-400 dark:text-gray-600">연이율</div>
                      </div>
                    ) : <span className="text-slate-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {isM ? (
                      hasPrice ? (
                        <div>
                          <div className="text-slate-700 dark:text-gray-200">
                            {fmt(priceData!.price, isKrw ? 0 : 2)}
                          </div>
                          <div className="text-[9px] text-slate-400 dark:text-gray-600">{priceData!.date}</div>
                        </div>
                      ) : (
                        <span className="text-yellow-500 flex items-center justify-end gap-1">
                          <AlertCircle size={9} /> —
                        </span>
                      )
                    ) : (
                      <div>
                        <input type="number" value={h.currentValue || ''}
                          onChange={e => updateHolding(h.id, 'currentValue', e.target.value)}
                          className="w-24 bg-transparent text-right text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 px-1" />
                        <div className="text-[9px] text-slate-400 dark:text-gray-600">평가액</div>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700 dark:text-gray-200">
                    {showPnl ? `₩${fmt(krwValue)}` : '—'}
                  </td>
                  <td className={`px-2 py-1.5 text-right ${showPnl ? pnlCls(pnl) : 'text-slate-300 dark:text-gray-600'}`}>
                    {showPnl ? `${sign(pnl)}₩${fmt(pnl)}` : '—'}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-bold ${showPnl ? pnlCls(pnl) : 'text-slate-300 dark:text-gray-600'}`}>
                    {showPnl ? (
                      <div className="flex items-center justify-end gap-1">
                        {pnl >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {sign(pnlPct)}{pnlPct.toFixed(2)}%
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={h.memo || ''}
                      onChange={e => updateHolding(h.id, 'memo', e.target.value)}
                      placeholder="—"
                      className="w-24 bg-transparent text-slate-400 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 px-1 text-[10px]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => deleteHolding(h.id)}
                      className="text-slate-300 dark:text-gray-600 hover:text-red-500">
                      <Trash2 size={10} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
