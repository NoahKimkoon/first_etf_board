/**
 * Yahoo Finance 시세 조회 API
 * 클라이언트 사이드 영구 캐싱 적용
 * ✅ 한 번 성공하면 영구히 캐시 사용 (API 호출 안 함)
 * ✅ 실패시에만 재시도
 */
export async function getQuote(ticker) {
  const cleanTicker = ticker.trim().toUpperCase();
  const CACHE_KEY = `stock_cache_${cleanTicker}`;
  const CACHE_TTL = 60 * 60 * 1000; // 1시간 유효기간

  try {
    if (!ticker || ticker.trim() === '') {
      return null;
    }

    // 캐시 데이터 확인 (1시간 유효기간)
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        
        if (now - cacheData.timestamp < CACHE_TTL) {
          console.debug(`캐시 사용: ${cleanTicker} (${Math.round((now - cacheData.timestamp)/1000/60)}분 전)`);
          return {
            ...cacheData.data,
            lastUpdated: new Date(cacheData.timestamp)
          };
        }
      }
    } catch (e) {
      console.debug('로컬 캐시 접근 오류', e);
    }

    // 캐시가 없을 때만 Yahoo Finance 프록시 API 호출
    const response = await fetch(`/api/stock/v8/finance/chart/${encodeURIComponent(cleanTicker)}?interval=1m&range=1d`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();

    if (data.chart?.error) {
      throw new Error(data.chart.error.description || '티커를 찾을 수 없습니다');
    }

    const result = data.chart?.result?.[0];
    if (!result) {
      throw new Error('데이터 형식 오류');
    }

    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    
    const stockData = {
      ticker: cleanTicker,
      price: currentPrice,
      previousClose: previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose * 100).toFixed(2),
      currency: meta.currency,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      lastUpdated: new Date()
    };

    // ✅ 성공했으면 1시간 캐시에 저장
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: stockData
      }));
      console.debug(`캐시 저장 완료: ${cleanTicker} (1시간 유효)`);
    } catch (e) {
      console.debug('로컬 캐시 저장 오류', e);
    }

    return stockData;

  } catch (error) {
    console.error('시세 조회 실패:', error);
    throw error;
  }
}

export default getQuote;