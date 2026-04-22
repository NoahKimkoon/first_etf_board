import React, { useState, useRef, useEffect } from 'react';
import ETF_PRESET from '../data/etfPreset';

const ETFSelector = ({ value, onChange, placeholder = 'ETF 선택' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 검색 필터링
  const filteredList = ETF_PRESET.filter(etf => 
    etf.name.toLowerCase().includes(search.toLowerCase()) ||
    etf.ticker.toLowerCase().includes(search.toLowerCase()) ||
    etf.category.includes(search)
  );

  // ETF 선택
  const selectETF = (etf) => {
    onChange(etf);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={value?.name || search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredList.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-center">검색 결과가 없습니다</div>
          ) : (
            filteredList.map((etf) => (
              <div
                key={etf.id}
                onClick={() => selectETF(etf)}
                className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-100 dark:border-slate-700 last:border-0 text-slate-900 dark:text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{etf.name}</div>
                  <div className="text-sm text-gray-500">{etf.ticker}</div>
                </div>
                <div className="text-xs text-gray-400 mt-1">{etf.category}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ETFSelector;