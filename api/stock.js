/**
 * Vercel Serverless Function - Yahoo Finance Proxy
 * 
 * ✅ 야후 차단 방지 정교한 헤더 적용
 * ✅ CORS 자동 처리
 * ✅ 로컬/배포 환경 동일 경로 지원
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

    // 요청 경로에서 /api/stock 부분 제거
    const yahooPath = req.url.replace(/^\/api\/stock/, '');
    
    if (!yahooPath || yahooPath === '/') {
      return res.status(400).json({ error: '요청 경로가 올바르지 않습니다' });
    }

    // Yahoo Finance 실제 엔드포인트
    const yahooUrl = `https://query1.finance.yahoo.com${yahooPath}`;

    // 야후 차단 방지 헤더 세트
    const response = await fetch(yahooUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Yahoo API Status: ${response.status}`);

      return res.status(response.status).json({ 
        error: `Yahoo API 오류: ${response.status}`,
        details: errorText.slice(0, 120)
      });
    }

    const data = await response.json();

    // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

    return res.status(200).json(data);

  } catch (error) {
    console.error('Stock API 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류' });
  }
}