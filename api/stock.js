/**
 * Vercel Serverless Function - Naver Finance Real-time API Proxy
 * 
 * ✅ 국내 주식/ETF 실시간 시세 지원
 * ✅ 네이버 금융 API 프록시
 * ✅ CORS 자동 처리
 * ✅ 국내 IP 차단 회피
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

    if (!ticker) {
      return res.status(400).json({ error: 'ticker 파라미터가 필요합니다' });
    }

    // 티커 정리 (숫자만 남김)
    ticker = ticker.replace(/[^0-9]/g, '');

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
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
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

    // CORS 및 캐싱 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(data.datas[0]);

  } catch (error) {
    console.error('Stock API 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류' });
  }
}