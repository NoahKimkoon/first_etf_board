import React from 'react';

const ETFCard = ({ etf, onRemove, livePrice, exchangeRate }) => {
  const quote = livePrice;
  const loading = !quote && !quote?.error;
  const error = quote?.error;
  const isOutdated = quote?.isOutdated;
  
  // ✅ 각 종목별 원화 환산 계산
  let currentValueKrw = null;
  let dollarPrice = null;

  if (quote?.price && quote?.currency) {
    if (quote.currency === 'USD') {
      dollarPrice = quote.price;
      currentValueKrw = (quote.price * exchangeRate.rate) * etf.quantity;
    } else {
      currentValueKrw = quote.price * etf.quantity;
    }
  }

  const profit = currentValueKrw ? currentValueKrw - etf.buyPrice : null;
  const returnRate = currentValueKrw ? ((currentValueKrw - etf.buyPrice) / etf.buyPrice * 100).toFixed(2) : null;

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // ✅ 52주 가격 범위 계산
  const hasFiftyTwoWeekData = quote?.fiftyTwoWeekHigh && quote?.fiftyTwoWeekLow && quote?.price;
  let pricePositionPercent = 0;
  let isNearHigh = false;

  if (hasFiftyTwoWeekData) {
    const range = quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow;
    if (range > 0) {
      const position = quote.price - quote.fiftyTwoWeekLow;
      pricePositionPercent = Math.min(100, Math.max(0, (position / range) * 100));
      isNearHigh = pricePositionPercent >= 90;
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">{etf.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            티커: {etf.ticker}
            {quote?.currency && <span className="ml-2 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded text-xs text-slate-600 dark:text-slate-200">{quote.currency}</span>}
          </p>
        </div>
        <button onClick={() => onRemove(etf.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 px-3 py-2">✕</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">매수금액</p>
          <p className="font-medium text-slate-800 dark:text-slate-100">{formatNumber(etf.buyPrice)} 원</p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">보유수량</p>
          <p className="font-medium text-slate-800 dark:text-slate-100">{formatNumber(etf.quantity)} 주</p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            현재금액
            {isOutdated ? (
              <span className="ml-1 text-amber-600 dark:text-amber-400 text-[10px] bg-amber-50 dark:bg-amber-900 px-1 py-0.5 rounded">직전가</span>
            ) : (
              <span className="ml-1 text-green-600 dark:text-green-400 text-[10px] bg-green-50 dark:bg-green-900 px-1 py-0.5 rounded">실시간</span>
            )}
          </p>
          {loading ? (
            <p className="font-medium text-slate-400 dark:text-slate-500">로딩중...</p>
          ) : error && !isOutdated ? (
            <p className="font-medium text-red-500">조회실패</p>
          ) : (
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {dollarPrice ? (
                  <>
                    ${dollarPrice.toFixed(2)}
                    <span className="text-slate-500 dark:text-slate-400 text-sm ml-1">(약 {formatNumber(currentValueKrw)} 원)</span>
                  </>
                ) : (
                  `${formatNumber(currentValueKrw)} 원`
                )}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">단가: {formatNumber(quote?.price)} {quote?.currency}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">수익률 / 수익금</p>
          {returnRate !== null ? (
            <p className={`font-bold ${returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {returnRate >= 0 ? '+' : ''}{returnRate} %
            </p>
          ) : (
            <p className="font-medium text-slate-400 dark:text-slate-500">-</p>
          )}
          {profit !== null && (
            <p className={`text-sm font-medium ${profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {profit >= 0 ? '+' : ''}{formatNumber(profit)} 원
            </p>
          )}
        </div>
      </div>


      {/* ✅ 52주 가격 범위 바 */}
      {hasFiftyTwoWeekData && (
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">52주 가격 범위</span>
              {isNearHigh && (
                <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                  📈 신고가 근접
                </span>
              )}
            </div>
          </div>

          <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            {/* 범위 게이지 바 */}
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 via-green-400 to-red-500 rounded-full"
              style={{ width: `${pricePositionPercent}%` }}
            />
            
            {/* 현재 가격 표시 점 */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-slate-800 dark:border-white rounded-full shadow-md z-10 transition-all duration-500"
              style={{ left: `calc(${pricePositionPercent}% - 8px)` }}
            />
          </div>

          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              최저가 ${quote.fiftyTwoWeekLow.toFixed(2)}
            </span>
            <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
              현재 ${quote.price.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              최고가 ${quote.fiftyTwoWeekHigh.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {quote?.lastUpdated && (
        <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-2">
          마지막 업데이트: {formatTime(quote.lastUpdated)}
        </p>
      )}
    </div>
  );
};

export default ETFCard;