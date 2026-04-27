/**
 * Vercel Serverless Function - Yahoo Finance Universal Proxy
 * 
 * ✅ 로컬 개발 환경 & Vercel 배포 환경 양쪽 모두 동일 경로로 동작
 * ✅ /api/yahoo/* 경로로 들어오는 모든 요청을 Yahoo Finance로 그대로 전달
 * ✅ CORS 헤더 자동 추가
 * ✅ User-Agent 헤더 포함으로 차단 방지
 */
export default async function handler(req, res) {
  try {
    // 요청 경로에서 /api/yahoo 부분 제거 후 실제 Yahoo 경로 추출
    const yahooPath = req.url.replace(/^\/api\/yahoo/, '');
    
    if (!yahooPath || yahooPath === '/') {
      return res.status(400).json({ error: '요청 경로가 올바르지 않습니다' });
    }

    // Yahoo Finance 실제 엔드포인트 구성
    const yahooUrl = `https://query1.finance.yahoo.com${yahooPath}`;

    // 서버 사이드에서 Yahoo API 호출
    const response = await fetch(yahooUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Yahoo API Status: ${response.status}, Body: ${errorText}`);

      // 404인 경우 티커가 없는 것, 403인 경우 차단된 것
      return res.status(response.status).json({ 
        error: `Yahoo API responded with ${response.status}`,
        details: errorText.slice(0, 100) // 에러 원인 일부 출력
      });
    }

    const data = await response.json();

    // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    // 원본 응답 그대로 클라이언트에 전달
    return res.status(200).json(data);

  } catch (error) {
    console.error('Yahoo Proxy 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류' });
  }
}