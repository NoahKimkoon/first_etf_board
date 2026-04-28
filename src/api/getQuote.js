/**
 * Yahoo Finance 시세 조회 API
 * 클라이언트 사이드 영구 캐싱 적용
 * ✅ 한 번 성공하면 영구히 캐시 사용 (API 호출 안 함)
 * ✅ 실패시에만 재시도
 */
export async function getQuote(ticker) {
  // const cleanTicker = ticker.trim().toUpperCase();
  const cleanTicker = ticker.replace('.KS', '');
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

    // 캐시가 없을 때만 Naver Finance 프록시 API 호출
    console.warn(" 캐시가 없을 때만 Naver Finance 프록시 API 호출");
    console.warn(" clenTicker:"+cleanTicker);
    const response = await fetch(`/api/stock?ticker=${encodeURIComponent(cleanTicker)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    console.warn(" data:"+data);

    if (data.error) {
      throw new Error(data.error || '종목코드를 찾을 수 없습니다');
    }

    // 네이버 금융 데이터 매핑
    const currentPrice = parseInt(data.closePrice);
    const previousClose = parseInt(data.previousClosePrice);
    const change = parseInt(data.compareToPreviousClosePrice);
    const changePercent = parseFloat(data.fluctuationsRatio);
    
    const stockData = {
      ticker: cleanTicker,
      name: data.stockName,
      price: currentPrice,
      previousClose: previousClose,
      change: change,
      changePercent: changePercent.toFixed(2),
      currency: 'KRW',
      marketState: data.marketStatus,
      lastUpdated: new Date()
    };
    console.warn("stockData:"+stockData);

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