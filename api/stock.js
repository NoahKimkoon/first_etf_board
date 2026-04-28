/**
 * Vercel Serverless Function - Naver Finance Domestic Stock Only
 * 
 * ✅ 국내 주식/ETF 전용 안정화 버전
 * ✅ 네이버 금융 실시간 API
 * ✅ 가장 안정적으로 동작했던 버전으로 원복
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

    // 티커 정리: .KS 제거 후 숫자 6자리만 추출
    ticker = ticker.trim().toUpperCase().replace('.KS', '').replace(/[^0-9]/g, '');

    if (ticker.length !== 6) {
      return res.status(400).json({ error: '유효한 6자리 국내 종목코드를 입력해주세요' });
    }

    // 네이버 금융 실시간 API 호출
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
      return res.status(response.status).json({ 
        error: `네이버 금융 API 오류: ${response.status}`
      });
    }

    const data = await response.json();

    // 응답 데이터 확인
    if (!data.datas || data.datas.length === 0) {
      return res.status(404).json({ error: `종목코드 ${ticker}의 데이터를 찾을 수 없습니다` });
    }

    const raw = data.datas[0];

    // 콤마가 포함된 문자열 숫자 변환
    const convertNumber = (str) => {
      if (!str) return 0;
      return parseInt(str.toString().replace(/,/g, ''));
    };

    // 데이터 정제 및 통일 포맷 반환
    const cleanedData = {
      ticker: ticker,
      name: raw.stockName,
      price: convertNumber(raw.closePrice),
      prevClose: convertNumber(raw.previousClosePrice),
      change: convertNumber(raw.compareToPreviousClosePrice),
      changePercent: parseFloat(raw.fluctuationsRatio),
      currency: 'KRW',
      marketState: raw.marketStatus,
      volume: convertNumber(raw.accumulatedTradingVolume)
    };

    // CORS 및 캐싱 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(cleanedData);

  } catch (error) {
    console.error('Stock API 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류' });
  }
}