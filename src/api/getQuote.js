/**
 * Yahoo Finance 시세 조회 API
 * 클라이언트 사이드 CORS 지원
 */
export async function getQuote(ticker) {
  try {
    if (!ticker || ticker.trim() === '') {
      return null;
    }

    // Vercel Serverless Function 프록시 호출
    const response = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker.trim())}`, {
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
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow;
    
    return {
      ticker: ticker.toUpperCase(),
      price: currentPrice,
      previousClose: previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose * 100).toFixed(2),
      currency: meta.currency,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      lastUpdated: new Date()
    };

  } catch (error) {
    console.error('시세 조회 실패:', error);
    throw error;
  }
}

export default getQuote;