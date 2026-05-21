import { NextRequest, NextResponse } from 'next/server';

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

async function fetchTicker(ticker: string) {
  const url = `${YF_BASE}/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');

  if (!tickersParam) {
    return NextResponse.json({ error: 'No tickers' }, { status: 400 });
  }

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean);
  const allTickers = [...new Set([...tickers, 'USDKRW=X'])];

  const results: Record<string, { price: number; currency: string; date: string; name: string }> = {};

  await Promise.allSettled(
    allTickers.map(async (ticker) => {
      try {
        const data = await fetchTicker(ticker);
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;

        const price = meta.regularMarketPrice ?? meta.previousClose;
        if (!price) return;

        const ts = meta.regularMarketTime ?? Date.now() / 1000;
        results[ticker] = {
          price,
          currency: meta.currency || 'USD',
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          name: meta.shortName || meta.longName || ticker,
        };
      } catch {
        // silently skip failed tickers
      }
    })
  );

  const usdkrw = results['USDKRW=X']?.price ?? 1380;

  return NextResponse.json({
    prices: results,
    usdkrw,
    fetchedAt: new Date().toISOString(),
  });
}
