/**
 * Alpha Vantage 시세 조회 API
 * 클라이언트 사이드 CORS 지원
 * ✅ 기존 인터페이스 완전 호환 유지
 * ✅ 호출 제한 오류 처리 추가
 */
export async function getQuote(ticker) {
  try {
    if (!ticker || ticker.trim() === '') {
      return null;
    }

    // Alpha Vantage 프록시 API 호출
    const response = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker.trim())}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status === 429) {
      throw new Error('API 호출 제한: 분당 5회 요청 제한이 있습니다. 잠시 후 다시 시도해주세요.');
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
    
    return {
      ticker: ticker.toUpperCase(),
      price: currentPrice,
      previousClose: currentPrice - change,
      change: change,
      changePercent: changePercent.toFixed(2),
      currency: 'USD',
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      lastUpdated: new Date()
    };

  } catch (error) {
    console.error('시세 조회 실패:', error);
    throw error;
  }
}

export default getQuote;