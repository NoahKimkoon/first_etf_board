/**
 * Vercel Serverless Function - Hybrid Stock API (Final)
 * 
 * ✅ .KS 접미사 기반 자동 판별
 * ✅ 국내: 네이버 금융 API
 * ✅ 해외: Yahoo Finance API
 * ✅ 100% 통일된 응답 포맷
 */
export default async function handler(req, res) {
  try {
    // CORS Preflight 처리
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    let ticker = url.searchParams.get('ticker');

    if (!ticker || ticker.trim() === '') {
      return res.status(400).json({ error: 'ticker 파라미터가 필요합니다' });
    }

    ticker = ticker.trim().toUpperCase();
    let result;

    // ✅ 국내 주식: .KS 접미사로 판별
    if (ticker.endsWith('.KS')) {
      const pureTicker = ticker.replace('.KS', '');
      result = await fetchNaverStock(pureTicker);
    } else {
      // ✅ 그 외 모든 티커는 해외 주식 (야후)
      result = await fetchYahooStock(ticker);
    }

    // ✅ 공통 응답 포맷 강제 통일
    const unifiedResponse = {
      ticker: ticker,
      name: String(result.name || ticker),
      price: Number(result.price || 0),
      prevClose: Number(result.prevClose || 0),
      change: Number(result.change || 0),
      changePercent: Number(result.changePercent || 0),
      currency: String(result.currency || 'USD')
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(unifiedResponse);

  } catch (error) {
    console.error('Stock API 오류:', error);
    return res.status(500).json({ error: error.message || '서버 내부 오류' });
  }
}

/**
 * 네이버 금융 국내 주식 조회
 */
async function fetchNaverStock(ticker) {
  const apiUrl = `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.naver.com/'
    }
  });

  if (!response.ok) throw new Error(`네이버 API 오류: ${response.status}`);

  const data = await response.json();
  if (!data.datas || data.datas.length === 0) throw new Error(`종목 ${ticker} 없음`);

  const raw = data.datas[0];
  const convertNumber = (str) => parseInt(str?.toString().replace(/,/g, '') || 0);

  return {
    name: raw.stockName,
    price: convertNumber(raw.closePrice),
    prevClose: convertNumber(raw.previousClosePrice),
    change: convertNumber(raw.compareToPreviousClosePrice),
    changePercent: parseFloat(raw.fluctuationsRatio),
    currency: 'KRW'
  };
}

/**
 * Yahoo Finance 해외 주식 조회
 */
async function fetchYahooStock(ticker) {
  const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com/'
    }
  });

  if (!response.ok) throw new Error(`야후 API 오류: ${response.status}`);

  const data = await response.json();
  if (data.chart?.error || !data.chart?.result?.[0]) throw new Error(`티커 ${ticker} 없음`);

  const meta = data.chart.result[0].meta;
  const currentPrice = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose || meta.previousClose;

  return {
    name: meta.longName || meta.shortName || ticker,
    price: currentPrice,
    prevClose: previousClose,
    change: currentPrice - previousClose,
    changePercent: ((currentPrice - previousClose) / previousClose * 100),
    currency: meta.currency
  };
}