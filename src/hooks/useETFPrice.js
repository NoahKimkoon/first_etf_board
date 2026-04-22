import { useState, useEffect, useCallback } from 'react';
import getQuote from '../api/getQuote';

export function useETFPrice(ticker) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrice = useCallback(async () => {
    if (!ticker || ticker.trim() === '') {
      setQuote(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getQuote(ticker);
      setQuote(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchPrice();

    // 30초마다 자동 갱신
    const intervalId = setInterval(fetchPrice, 30000);

    return () => clearInterval(intervalId);
  }, [fetchPrice]);

  return {
    quote,
    loading,
    error,
    refresh: fetchPrice
  };
}

export default useETFPrice;
