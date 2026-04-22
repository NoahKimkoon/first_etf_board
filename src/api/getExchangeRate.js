/**
 * 실시간 USD/KRW 환율 조회 API
 */
export async function getExchangeRate() {
  try {
    const targetUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1m&range=1d';
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'omit'
    });

    if (!response.ok) {
      throw new Error(`환율 API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.chart?.error) {
      throw new Error(data.chart.error.description || '환율을 찾을 수 없습니다');
    }

    const result = data.chart?.result?.[0];
    if (!result) {
      throw new Error('환율 데이터 형식 오류');
    }

    const rate = result.meta.regularMarketPrice;

    return {
      pair: 'USD/KRW',
      rate: rate,
      lastUpdated: new Date()
    };

  } catch (error) {
    console.error('환율 조회 실패:', error);
    // 실패시 기본값 1360원 반환
    return {
      pair: 'USD/KRW',
      rate: 1360,
      lastUpdated: new Date(),
      fallback: true
    };
  }
}

// 통화 타입 자동 판단
export function detectCurrency(ticker) {
  if (!ticker) return 'KRW';
  const upperTicker = ticker.toUpperCase().trim();
  
  if (upperTicker.endsWith('.KS') || upperTicker.endsWith('.KQ')) {
    return 'KRW';
  }
  
  return 'USD';
}

export default getExchangeRate;