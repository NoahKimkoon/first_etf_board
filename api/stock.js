/**
 * Vercel Serverless Function - Hybrid Stock API
 * 
 * ✅ 국내/해외 주식 자동 판별 하이브리드 API
 * ✅ 국내: 네이버 금융 실시간 API
 * ✅ 해외: Yahoo Finance API
 * ✅ 자동 티커 감지
 * ✅ 통일된 응답 포맷
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

    // 쿼리 파라미터에서 티커 추출
    const url = new URL(req.url, `http://${req.headers.host}`);
    let ticker = url.searchParams.get('ticker');

    if (!ticker || ticker.trim() === '') {
      return res.status(400).json({ error: 'ticker 파라미터가 필요합니다' });
    }

    ticker = ticker.trim().toUpperCase();

    // 티커 판별 로직: .KS 접미사로 국내 주식 구분
    const isKoreanStock = ticker.endsWith('.KS');
    let result;

    if (isKoreanStock) {
      // ✅ 국내 주식: .KS 제거 후 네이버 금융 API 호출
      const pureTicker = ticker.replace('.KS', '');
      result = await fetchNaverStock(pureTicker);
      // result.ticker = ticker; // 원본 티커 유지
    } else {
      // ✅ 해외 주식: 그대로 야후 파이낸스 API 호출
      result = await fetchYahooStock(ticker);
    }

    // CORS 및 캐싱 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(result);

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
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Referer': 'https://finance.naver.com/',
      'Cache-Control': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`네이버 API 오류: ${response.status}`);
  }

  const data = await response.json();

  if (!data.datas || data.datas.length === 0) {
    throw new Error(`종목 ${ticker}을(를) 찾을 수 없습니다`);
  }

  const raw = data.datas[0];
  const convertNumber = (str) => parseInt(str?.toString().replace(/,/g, '') || 0);

  return {
    ticker: ticker,
    name: raw.stockName,
    price: convertNumber(raw.closePrice),
    prevClose: convertNumber(raw.previousClosePrice),
    change: convertNumber(raw.compareToPreviousClosePrice),
    changePercent: parseFloat(raw.fluctuationsRatio),
    currency: 'KRW',
    market: 'KOSPI'
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
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
      'Origin': 'https://finance.yahoo.com',
      'Cache-Control': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo API 오류: ${response.status}`);
  }

  const data = await response.json();

  if (data.chart?.error || !data.chart?.result?.[0]) {
    throw new Error(`티커 ${ticker}을(를) 찾을 수 없습니다`);
  }

  const meta = data.chart.result[0].meta;
  const currentPrice = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose || meta.previousClose;

  return {
    ticker: ticker,
    name: meta.longName || meta.shortName || ticker,
    price: currentPrice,
    prevClose: previousClose,
    change: currentPrice - previousClose,
    changePercent: ((currentPrice - previousClose) / previousClose * 100),
    currency: meta.currency,
    market: meta.exchangeName
  };
}