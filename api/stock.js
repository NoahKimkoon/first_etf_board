/**
 * Vercel Serverless Function - Alpha Vantage Stock API
 * 
 * ✅ 야후 API 대체로 Alpha Vantage 사용
 * ✅ 기존 데이터 형식과 호환성 유지
 * ✅ 호출 제한 오류 처리 추가
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
    const ticker = url.searchParams.get('ticker');

    if (!ticker) {
      return res.status(400).json({ error: 'ticker 파라미터가 필요합니다' });
    }

    // Alpha Vantage API 키 확인
    const apiKey = process.env.STOCK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'STOCK_API_KEY 환경 변수가 설정되지 않았습니다' });
    }

    // Alpha Vantage API 호출
    const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ETF-Board-App/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Alpha Vantage API 오류: ${response.status}`,
        retryAfter: 60
      });
    }

    const data = await response.json();

    // Alpha Vantage 제한 초과 응답 확인
    if (data['Information'] && data['Information'].includes('rate limit')) {
      return res.status(429).json({
        error: 'API 호출 제한에 도달했습니다',
        message: 'Alpha Vantage 무료 티어는 분당 5회, 일일 500회 제한이 있습니다',
        retryAfter: 60
      });
    }

    // 데이터가 없는 경우
    if (!data['Global Quote'] || Object.keys(data['Global Quote']).length === 0) {
      return res.status(404).json({ error: `티커 ${ticker}의 데이터를 찾을 수 없습니다` });
    }

    // Alpha Vantage 응답을 기존 형식과 매핑
    const quote = data['Global Quote'];
    const mappedData = {
      quoteResponse: {
        result: [{
          symbol: quote['01. symbol'],
          regularMarketPrice: parseFloat(quote['05. price']),
          regularMarketChange: parseFloat(quote['09. change']),
          regularMarketChangePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          marketState: 'REGULAR',
          tradeable: true
        }],
        error: null
      }
    };

    // CORS 및 캐싱 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(mappedData);

  } catch (error) {
    console.error('Stock API 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류' });
  }
}