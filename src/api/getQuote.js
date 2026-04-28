/**
 * Alpha Vantage 시세 조회 API
 * 클라이언트 사이드 CORS 지원
 * ✅ 기존 인터페이스 완전 호환 유지
 * ✅ 호출 제한 오류 처리 추가
 * ✅ localStorage 5분 캐싱 적용
 */
export async function getQuote(ticker) {
  const cleanTicker = ticker.trim().toUpperCase();
  const CACHE_KEY = `stock_cache_${cleanTicker}`;
  const CACHE_TTL = 5 * 60 * 1000; // 5분

  try {
    if (!ticker || ticker.trim() === '') {
      return null;
    }

    // 캐시 데이터 확인
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        
        if (now - cacheData.timestamp < CACHE_TTL) {
          console.debug(`캐시 사용: ${cleanTicker} (${Math.round((now - cacheData.timestamp)/1000)}초 전)`);
          return {
            ...cacheData.data,
            lastUpdated: new Date(cacheData.timestamp)
          };
        }
      }
    } catch (e) {
      // localStorage 오류 무시하고 계속 진행
      console.debug('로컬 캐시 접근 오류', e);
    }

    // Alpha Vantage 프록시 API 호출
    const response = await fetch(`/api/stock?ticker=${encodeURIComponent(cleanTicker)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status === 429) {
      throw new Error('잠시 후 다시 시도해 주세요. 요청 제한이 발생했습니다. (무료 티어는 분당 5회 요청 제한이 있습니다)');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API 응답 오류: ${response.status}`);
    }

    const data = await response.json();

    if (data.quoteResponse?.error) {
      throw new Error(data.quoteResponse.error.description || '티커를 찾을 수 없습니다');
    }

    const result = data.quoteResponse?.result?.[0];
    if (!result) {
      throw new Error('데이터 형식 오류');
    }

    const currentPrice = result.regularMarketPrice;
    const change = result.regularMarketChange;
    const changePercent = result.regularMarketChangePercent;
    
    const stockData = {
      ticker: cleanTicker,
      price: currentPrice,
      previousClose: currentPrice - change,
      change: change,
      changePercent: changePercent.toFixed(2),
      currency: 'USD',
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      lastUpdated: new Date()
    };

    // 성공적으로 데이터를 가져왔으면 캐시에 저장
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: stockData
      }));
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