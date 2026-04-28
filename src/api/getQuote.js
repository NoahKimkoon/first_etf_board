/**
 * Naver Finance 시세 조회 API
 * 클라이언트 사이드 1시간 캐싱 적용
 * ✅ 서버 응답 필드 정확 매핑
 * ✅ 타입 안정성 강화
 * ✅ 디버깅 로그 추가
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
          console.debug(`✅ 캐시 사용: ${cleanTicker} (${Math.round((now - cacheData.timestamp)/1000/60)}분 전)`);
          return {
            ...cacheData.data,
            lastUpdated: new Date(cacheData.timestamp)
          };
        }
      }
    } catch (e) {
      console.debug('로컬 캐시 접근 오류', e);
    }

    // 네이버 금융 프록시 API 호출
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
    console.log('✅ Raw API Response:', data);

    if (data.error) {
      throw new Error(data.error || '종목코드를 찾을 수 없습니다');
    }

    // ✅ 서버 응답 필드 정확 매핑 + 안전한 타입 변환
    const currentPrice = Number(data.price || 0);
    const previousClose = Number(data.prevClose || 0);
    const change = Number(data.change || 0);
    const changePercent = Number(data.changePercent || 0);
    
    const stockData = {
      ticker: cleanTicker,
      name: data.name || cleanTicker,
      price: currentPrice,
      previousClose: previousClose,
      change: change,
      changePercent: changePercent.toFixed(2),
      currency: data.currency || 'KRW',
      marketState: data.marketState,
      lastUpdated: new Date()
    };

    console.log('✅ Parsed Stock Data:', stockData);

    // 성공했으면 1시간 캐시에 저장
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: stockData
      }));
      console.debug(`✅ 캐시 저장 완료: ${cleanTicker} (1시간 유효)`);
    } catch (e) {
      console.debug('로컬 캐시 저장 오류', e);
    }

    return stockData;

  } catch (error) {
    console.error('❌ 시세 조회 실패:', error);
    throw error;
  }
}

export default getQuote;