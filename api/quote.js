/**
 * Vercel Serverless Function - Yahoo Finance Proxy API
 * CORS 우회를 위한 프록시 서버
 */
export default async function handler(req, res) {
  try {
    // 쿼리 파라미터에서 티커 추출
    const { ticker } = req.query;
    
    if (!ticker || ticker.trim() === '') {
      return res.status(400).json({ error: 'ticker 파라미터가 필요합니다' });
    }

    // Yahoo Finance API 엔드포인트
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.trim())}?interval=1m&range=1d`;

    // 서버 사이드에서 Yahoo API 호출 (CORS 문제 발생 안함)
    const response = await fetch(yahooUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Yahoo API 응답 오류: ${response.status}` 
      });
    }

    const data = await response.json();

    // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    // 원본 데이터 그대로 클라이언트에 전달
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy API 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류' });
  }
}