import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import ETFCard from './components/ETFCard'
import ETFSelector from './components/ETFSelector'
import getQuote from './api/getQuote'
import getExchangeRate, { detectCurrency } from './api/getExchangeRate'
import ETF_PRESET from './data/etfPreset'
import { db } from './firebase'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore'

Chart.register(...registerables)

// ✅ 숫자 포맷 유틸 함수
const formatNumber = (num) => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

function App() {
  // ✅ 활성 탭 상태 관리
  const [activeTab, setActiveTab] = useState('investment');

  // Firestore 실시간 데이터 상태
  const [etfs, setEtfs] = useState([]);
  const [dividendList, setDividendList] = useState([]);
  const [kidsEtfs, setKidsEtfs] = useState([]);
  
  // 임시 사용자 ID
  const USER_ID = "guest";

  // 실시간 가격 상태
  const [prices, setPrices] = useState({});
  const [exchangeRate, setExchangeRate] = useState({ rate: 1360 });
  
  const [newEtf, setNewEtf] = useState({
    selectedETF: null,
    buyPrice: '',
    quantity: ''
  });

  // ✅ 아이 자산 입력 폼 상태
  const [newKidsEtf, setNewKidsEtf] = useState({
    selectedETF: null,
    buyPrice: '',
    quantity: ''
  });

  // ✅ 배당 입력 폼 상태
  const [newDividend, setNewDividend] = useState({
    selectedETF: null,
    name: '',
    ticker: '',
    currency: 'KRW',
    dividendPerShare: 0,
    quantity: 0,
    dividendMonths: []
  });

  // ✅ 배당 차트 레퍼런스
  const dividendChartRef = useRef(null);
  const dividendChartInstance = useRef(null);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const pieChartRef = useRef(null);
  const pieChartInstance = useRef(null);
  const futureAssetChartRef = useRef(null);
  const futureAssetChartInstance = useRef(null);

  // ✅ Firestore 실시간 리스너 설정
  useEffect(() => {
    console.log('✅ Firestore 리스너 시작');
    
    // ETF 컬렉션 리스너
    const etfQuery = query(collection(db, 'etfs'), where('userId', '==', USER_ID));
    const unsubEtfs = onSnapshot(etfQuery, 
      (snapshot) => {
        console.log('✅ ETF 데이터 수신:', snapshot.size, '개');
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('✅ 로드된 ETF 데이터:', data);
        setEtfs(data);
      },
      (error) => {
        console.error('❌ ETF 리스너 오류:', error);
        console.error('❌ 오류 코드:', error.code);
      }
    );

    // 배당 컬렉션 리스너
    const dividendQuery = query(collection(db, 'dividendList'), where('userId', '==', USER_ID));
    const unsubDividends = onSnapshot(dividendQuery, 
      (snapshot) => {
        console.log('✅ 배당 데이터 수신:', snapshot.size, '개');
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setDividendList(data);
      },
      (error) => {
        console.error('❌ 배당 리스너 오류:', error);
      }
    );

    // 아이 ETF 컬렉션 리스너
    const kidsQuery = query(collection(db, 'kidsEtfs'), where('userId', '==', USER_ID));
    const unsubKids = onSnapshot(kidsQuery, 
      (snapshot) => {
        console.log('✅ 아이 ETF 데이터 수신:', snapshot.size, '개');
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setKidsEtfs(data);
      },
      (error) => {
        console.error('❌ 아이 ETF 리스너 오류:', error);
      }
    );

    // 클린업 함수
    return () => {
      console.log('✅ Firestore 리스너 정리');
      unsubEtfs();
      unsubDividends();
      unsubKids();
    };
  }, []);

  // ✅ 다크모드 테마 토글
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('etf-dashboard-theme');
      return saved === 'dark' ? true : false;
    } catch {
      return true; // 기본 다크모드
    }
  });

  // ✅ 다크모드 상태 변경시 html 클래스 업데이트
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('etf-dashboard-theme', isDarkMode ? 'dark' : 'light');
    console.log('✅ 테마 변경:', isDarkMode ? '다크모드 ON' : '라이트모드 ON');
    console.log('✅ html 클래스:', [...document.documentElement.classList]);
  }, [isDarkMode]);

  // ✅ 환율 실시간 조회
  useEffect(() => {
    const fetchRate = async () => {
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    };
    
    fetchRate();
    const interval = setInterval(fetchRate, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  // 실시간 가격 조회
  useEffect(() => {
    if (etfs.length === 0 && kidsEtfs.length === 0) return;

    const fetchAllPrices = async () => {
      const newPrices = { ...prices };

      // ✅ 내 자산 가격 조회
      for (const etf of etfs) {
        try {
          const quote = await getQuote(etf.ticker);
          const currency = detectCurrency(etf.ticker);
          
          newPrices[etf.id] = {
            ...quote,
            currency: currency,
            priceKrw: currency === 'USD' 
              ? quote.price * exchangeRate.rate 
              : quote.price,
            error: null
          };
        } catch (err) {
          if (prices[etf.id] && prices[etf.id].priceKrw) {
            newPrices[etf.id] = {
              ...prices[etf.id],
              error: err.message,
              isOutdated: true
            };
          } else {
            newPrices[etf.id] = { error: err.message };
          }
        }
      }

      // ✅ 아이 자산 가격 조회
      for (const etf of kidsEtfs) {
        try {
          const quote = await getQuote(etf.ticker);
          const currency = detectCurrency(etf.ticker);
          
          newPrices[etf.id] = {
            ...quote,
            currency: currency,
            priceKrw: currency === 'USD' 
              ? quote.price * exchangeRate.rate 
              : quote.price,
            error: null
          };
        } catch (err) {
          if (prices[etf.id] && prices[etf.id].priceKrw) {
            newPrices[etf.id] = {
              ...prices[etf.id],
              error: err.message,
              isOutdated: true
            };
          } else {
            newPrices[etf.id] = { error: err.message };
          }
        }
      }
      
      setPrices(newPrices);
    };

    fetchAllPrices();
    
    // 30초마다 갱신
    const interval = setInterval(fetchAllPrices, 30000);
    
    return () => clearInterval(interval);
  }, [etfs, kidsEtfs, exchangeRate.rate]);

  // 총계 계산
  const totalData = useMemo(() => {
    let totalBuy = 0;
    let totalCurrent = 0;

    etfs.forEach(etf => {
      totalBuy += etf.buyPrice;
      const price = prices[etf.id]?.priceKrw;
      if (price) {
        totalCurrent += price * etf.quantity;
      } else {
        totalCurrent += etf.buyPrice;
      }
    });

    // ✅ 원화 통일 수익률 계산식
    const totalReturn = totalBuy > 0 ? Math.round((totalCurrent - totalBuy) / totalBuy * 100) : 0;
    const totalProfit = Math.round(totalCurrent - totalBuy);

    return {
      totalBuy: Math.round(totalBuy),
      totalCurrent: Math.round(totalCurrent),
      totalReturn,
      totalProfit
    };
  }, [etfs, prices]);

  // ✅ 아이 자산 총계 계산
  const kidsTotalData = useMemo(() => {
    let totalBuy = 0;
    let totalCurrent = 0;

    kidsEtfs.forEach(etf => {
      totalBuy += etf.buyPrice;
      const price = prices[etf.id]?.priceKrw;
      if (price) {
        totalCurrent += price * etf.quantity;
      } else {
        totalCurrent += etf.buyPrice;
      }
    });

    const totalReturn = totalBuy > 0 ? Math.round((totalCurrent - totalBuy) / totalBuy * 100) : 0;
    const totalProfit = Math.round(totalCurrent - totalBuy);

    return {
      totalBuy: Math.round(totalBuy),
      totalCurrent: Math.round(totalCurrent),
      totalReturn,
      totalProfit
    };
  }, [kidsEtfs, prices]);

  // ✅ 미래 자산 계산기 상태
  const [futureAssetParams, setFutureAssetParams] = useState({
    expectedRate: 7,
    monthlyInvestment: 500000
  });

  // ✅ 미래 자산 복리 계산
  const futureAssetData = useMemo(() => {
    const initialAmount = kidsTotalData.totalBuy;
    const monthlyRate = futureAssetParams.expectedRate / 100 / 12;
    const monthlyAdd = futureAssetParams.monthlyInvestment;
    
    const yearlyData = [];
    let currentAmount = initialAmount;

    yearlyData.push({ year: 0, amount: Math.round(currentAmount) });

    for (let year = 1; year <= 10; year++) {
      for (let month = 1; month <= 12; month++) {
        currentAmount = currentAmount * (1 + monthlyRate) + monthlyAdd;
      }
      yearlyData.push({ year, amount: Math.round(currentAmount) });
    }

    const finalAmount = yearlyData[yearlyData.length - 1].amount;
    const totalInvestment = initialAmount + (monthlyAdd * 120);
    const expectedProfit = finalAmount - totalInvestment;

    return {
      yearlyData,
      finalAmount,
      totalInvestment,
      expectedProfit
    };
  }, [kidsTotalData.totalBuy, futureAssetParams]);

  // ✅ 미래 자산 차트 업데이트
  useEffect(() => {
    if (futureAssetChartRef.current && kidsEtfs.length > 0) {
      if (futureAssetChartInstance.current) {
        futureAssetChartInstance.current.destroy();
      }
      
      const ctx = futureAssetChartRef.current.getContext('2d');
      futureAssetChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: futureAssetData.yearlyData.map(item => `${item.year}년`),
          datasets: [{
            label: '예상 자산',
            data: futureAssetData.yearlyData.map(item => item.amount),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `${formatNumber(Math.round(context.raw))} 원`;
                }
              }
            }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              grid: { color: isDarkMode ? '#334155' : '#e2e8f0' },
              ticks: {
                color: isDarkMode ? '#cbd5e1' : '#475569',
                callback: (value) => formatNumber(value / 10000000) + '억'
              }
            },
            x: { 
              grid: { display: false }, 
              ticks: { color: isDarkMode ? '#cbd5e1' : '#475569' } 
            }
          }
        }
      });
    }
    
    return () => { if (futureAssetChartInstance.current) futureAssetChartInstance.current.destroy(); };
  }, [futureAssetData, isDarkMode, kidsEtfs.length]);

  // ✅ 배당 정보 업데이트 함수
  const updateDividendInfo = (etfId, field, value) => {
    setEtfs(etfs.map(etf => {
      if (etf.id === etfId) {
        return { ...etf, [field]: value };
      }
      return etf;
    }));
  };

  // ✅ ETF 추가 (Firestore)
  const addEtf = async (e) => {
    e.preventDefault();
    if (!newEtf.selectedETF || !newEtf.buyPrice || !newEtf.quantity) return;

    const today = new Date();
    const etfData = {
      userId: USER_ID,
      name: newEtf.selectedETF.name,
      ticker: newEtf.selectedETF.ticker,
      buyPrice: parseInt(newEtf.buyPrice),
      quantity: parseInt(newEtf.quantity),
      dividendPerShare: 0,
      dividendCycle: 'quarterly',
      createdAt: new Date(),
      purchaseDate: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    };
    
    console.log('✅ 저장하려는 ETF 데이터:', etfData);
    
    try {
      const docRef = await addDoc(collection(db, 'etfs'), etfData);
      console.log('✅ Firestore 저장 성공! 문서 ID:', docRef.id);
      setNewEtf({ selectedETF: null, buyPrice: '', quantity: '' });
    } catch (error) {
      console.error('❌ Firestore 저장 오류:', error);
      console.error('❌ 오류 코드:', error.code);
      console.error('❌ 오류 메시지:', error.message);
      alert('저장 오류: ' + error.message);
    }
  };

  // ✅ 아이 자산 ETF 추가 (Firestore)
  const addKidsEtf = async (e) => {
    e.preventDefault();
    if (!newKidsEtf.selectedETF || !newKidsEtf.buyPrice || !newKidsEtf.quantity) return;

    const today = new Date();
    const etfData = {
      userId: USER_ID,
      name: newKidsEtf.selectedETF.name,
      ticker: newKidsEtf.selectedETF.ticker,
      buyPrice: parseInt(newKidsEtf.buyPrice),
      quantity: parseInt(newKidsEtf.quantity),
      dividendPerShare: 0,
      dividendCycle: 'quarterly',
      createdAt: new Date(),
      purchaseDate: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    };
    
    await addDoc(collection(db, 'kidsEtfs'), etfData);
    setNewKidsEtf({ selectedETF: null, buyPrice: '', quantity: '' });
  };

  // ETF 삭제 (Firestore)
  const removeEtf = async (id) => {
    await deleteDoc(doc(db, 'etfs', id));
    setPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[id];
      return newPrices;
    });
  };

  // ✅ 아이 자산 ETF 삭제 (Firestore)
  const removeKidsEtf = async (id) => {
    await deleteDoc(doc(db, 'kidsEtfs', id));
    setPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[id];
      return newPrices;
    });
  };

  // ✅ 배당 종목 추가 (Firestore)
  const addDividendItem = async (e) => {
    if (e) e.preventDefault();
    
    // 유효성 검사 완화 (이름만 필수)
    if (!newDividend.name || newDividend.name.trim() === '') {
      alert('종목명을 입력해주세요');
      return;
    }
    
    const dividendData = {
      userId: USER_ID,
      name: newDividend.name.trim(),
      ticker: newDividend.ticker || '',
      currency: newDividend.currency,
      dividendPerShare: Number(newDividend.dividendPerShare) || 0,
      quantity: Number(newDividend.quantity) || 0,
      dividendMonths: [...newDividend.dividendMonths],
      createdAt: new Date()
    };
    
    await addDoc(collection(db, 'dividendList'), dividendData);
    
    // 상태 초기화
    setNewDividend({
      selectedETF: null,
      name: '',
      ticker: '',
      currency: 'KRW',
      dividendPerShare: 0,
      quantity: 0,
      dividendMonths: []
    });
  };

  // ✅ 배당 종목 삭제 (Firestore)
  const removeDividendItem = async (id) => {
    await deleteDoc(doc(db, 'dividendList', id));
  };

  // ✅ 배당월 토글
  const toggleDividendMonth = (month) => {
    setNewDividend(prev => {
      if (prev.dividendMonths.includes(month)) {
        return { ...prev, dividendMonths: prev.dividendMonths.filter(m => m !== month) };
      } else {
        return { ...prev, dividendMonths: [...prev.dividendMonths, month].sort() };
      }
    });
  };

  // ✅ 차트 데이터 티커별 합산 로직
  const chartData = useMemo(() => {
    // 티커 기준으로 그룹핑 및 합산
    const grouped = etfs.reduce((acc, etf) => {
      const price = prices[etf.id]?.priceKrw;
      const currentValue = price ? price * etf.quantity : etf.buyPrice;

      if (!acc[etf.ticker]) {
        acc[etf.ticker] = {
          name: etf.name,
          ticker: etf.ticker,
          totalBuy: 0,
          totalCurrent: 0
        };
      }

      acc[etf.ticker].totalBuy += etf.buyPrice;
      acc[etf.ticker].totalCurrent += currentValue;

      return acc;
    }, {});

    return Object.values(grouped).map(item => ({
      ...item,
      returnRate: item.totalBuy > 0 
        ? ((item.totalCurrent - item.totalBuy) / item.totalBuy * 100)
        : 0
    }));
  }, [etfs, prices]);

  // 차트 업데이트
  useEffect(() => {
    if (chartRef.current && chartData.length > 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      const ctx = chartRef.current.getContext('2d');
      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.map(item => item.name),
          datasets: [{
            label: '수익률 (%)',
            data: chartData.map(item => item.returnRate),
            backgroundColor: chartData.map(item => {
              return item.returnRate >= 0 ? '#dc2626' : '#2563eb';
            }),
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
            x: { grid: { display: false }, ticks: { color: '#475569' } }
          }
        }
      });
    }
    
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [chartData]);

  // ✅ 종목별 비중 도넛 차트
  useEffect(() => {
    if (pieChartRef.current && chartData.length > 0) {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
      
      const totalSum = chartData.reduce((sum, item) => sum + item.totalCurrent, 0);
      const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'
      ];
      
      const ctx = pieChartRef.current.getContext('2d');
      pieChartInstance.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartData.map(item => item.name),
          datasets: [{
            data: chartData.map(item => item.totalCurrent),
            backgroundColor: colors.slice(0, chartData.length),
            borderWidth: 2,
            borderColor: isDarkMode ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: isDarkMode ? '#f1f5f9' : '#334155',
                padding: 15,
                usePointStyle: true
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const value = context.raw;
                  const percentage = ((value / totalSum) * 100).toFixed(1);
                  return `${context.label}: ${new Intl.NumberFormat('ko-KR').format(value)} 원 (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
    
    return () => { if (pieChartInstance.current) pieChartInstance.current.destroy(); };
  }, [chartData, isDarkMode]);

  // ✅ 배당 통계 계산 (다중 통화 지원 + 월별 데이터)
  const dividendCalculated = useMemo(() => {
    const monthlyAmountKrw = Array(12).fill(0);
    let totalAnnualKrw = 0;
    let totalAnnualUsd = 0;

    dividendList.forEach(item => {
      const perPayment = item.dividendPerShare * item.quantity;
      const currency = item.currency || 'KRW';
      
      let amountKrw = perPayment;
      if (currency === 'USD') {
        amountKrw = perPayment * exchangeRate.rate;
        totalAnnualUsd += perPayment * item.dividendMonths.length;
      }
      
      item.dividendMonths.forEach(month => {
        monthlyAmountKrw[month - 1] += amountKrw;
        totalAnnualKrw += amountKrw;
      });
    });

    const taxRate = 0.154;
    const totalAnnualNet = totalAnnualKrw * (1 - taxRate);
    const monthlyAvg = totalAnnualNet / 12;

    return {
      monthlyAmountKrw,
      totalAnnualKrw,
      totalAnnualUsd,
      totalAnnualNet,
      monthlyAvg
    };
  }, [dividendList, exchangeRate.rate]);

  // ✅ 배당 월별 차트 업데이트
  useEffect(() => {
    if (dividendChartRef.current && dividendList.length > 0) {
      if (dividendChartInstance.current) {
        dividendChartInstance.current.destroy();
      }
      
      const ctx = dividendChartRef.current.getContext('2d');
      dividendChartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
          datasets: [{
            label: '예상 배당금 (원)',
            data: dividendCalculated.monthlyAmountKrw,
            backgroundColor: '#f59e0b',
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `${formatNumber(Math.round(context.raw))} 원`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: isDarkMode ? '#334155' : '#e2e8f0'
              },
              ticks: {
                color: isDarkMode ? '#cbd5e1' : '#475569',
                callback: (value) => formatNumber(value)
              }
            },
            x: {
              grid: { display: false },
              ticks: {
                color: isDarkMode ? '#cbd5e1' : '#475569'
              }
            }
          }
        }
      });
    }
    
    return () => { if (dividendChartInstance.current) dividendChartInstance.current.destroy(); };
  }, [dividendCalculated.monthlyAmountKrw, isDarkMode, dividendList.length]);

  // ✅ JSON 데이터 내보내기 (Export)
  const exportData = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `etf-backup-${dateStr}.json`;
    const jsonData = JSON.stringify(etfs, null, 2);
    
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ✅ JSON 데이터 불러오기 (Import)
  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        if (Array.isArray(importedData)) {
          // 기존 데이터와 병합 (기존 데이터 유지 + 새 데이터 추가)
          const existingIds = new Set(etfs.map(etf => etf.id));
          const newItems = importedData.filter(item => !existingIds.has(item.id));
          
          if (newItems.length > 0) {
            setEtfs(prev => [...prev, ...newItems]);
            alert(`${newItems.length}개의 ETF 데이터가 복구되었습니다.`);
          } else {
            alert('복구할 새로운 데이터가 없습니다. (이미 동일한 데이터가 존재합니다)');
          }
        } else {
          alert('유효하지 않은 백업 파일 형식입니다.');
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.');
      }
      
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">📈 ETF 실시간 투자 대시보드</h1>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition text-2xl shadow-md"
            title="테마 변경"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* ✅ 네비게이션 탭 */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('investment')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'investment' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            📊 내 자산
          </button>
          <button
            onClick={() => setActiveTab('kids')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'kids' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            👶 아이 자산
          </button>
          <button
            onClick={() => setActiveTab('dividend')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'dividend' 
                ? 'bg-amber-500 text-white shadow-md' 
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            💰 배당 관리
          </button>
        </div>
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-3">
          현재 적용 환율: 1 USD = {formatNumber(exchangeRate.rate)} KRW | 마지막 갱신: {exchangeRate.lastUpdated?.toLocaleTimeString('ko-KR') || '-' }
        </p>
        
        {/* 백업/복구 버튼 영역 */}
        <div className="flex justify-center gap-3 mb-8">
          <input 
            type="file" 
            accept=".json"
            onChange={importData}
            ref={(el) => { window.importFileInput = el; }}
            className="hidden"
          />
          <button
            onClick={exportData}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition shadow-sm"
          >
            💾 데이터 백업 (JSON)
          </button>
          <button
            onClick={() => window.importFileInput.click()}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition shadow-sm"
          >
            📂 데이터 복구
          </button>
        </div>

        {/* ✅ 투자 현황 탭 */}
        <div className={activeTab === 'investment' ? '' : 'hidden'}>
            {/* 총 현황 카드 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">총 투자 현황</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 투자금액</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{formatNumber(totalData.totalBuy)} 원</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 현재금액</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{formatNumber(totalData.totalCurrent)} 원</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 수익금</p>
                  <p className={`text-xl font-bold ${totalData.totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {totalData.totalProfit >= 0 ? '+' : ''}{formatNumber(totalData.totalProfit)} 원
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 수익률</p>
                  <p className={`text-xl font-bold ${totalData.totalReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {totalData.totalReturn >= 0 ? '+' : ''}{totalData.totalReturn} %
                  </p>
                </div>
              </div>
            </div>

            {/* 입력 폼 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">ETF 추가</h2>
              <form onSubmit={addEtf} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ETFSelector
                  value={newEtf.selectedETF}
                  onChange={(etf) => setNewEtf({...newEtf, selectedETF: etf})}
                  placeholder="ETF를 검색하거나 선택하세요"
                />
                <input
                  type="number"
                  placeholder="매수금액 (원화)"
                  value={newEtf.buyPrice}
                  onChange={(e) => setNewEtf({...newEtf, buyPrice: e.target.value})}
                  className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
                <input
                  type="number"
                  placeholder="보유수량"
                  value={newEtf.quantity}
                  onChange={(e) => setNewEtf({...newEtf, quantity: e.target.value})}
                  className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700 transition"
                >
                  추가하기
                </button>
              </form>
            </div>

            {/* ETF 목록 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">보유 ETF 목록</h2>
              {etfs.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">등록된 ETF가 없습니다. 위 폼에서 추가해주세요</p>
              ) : (
                <div className="space-y-4">
                  {etfs.slice().reverse().map((etf) => (
                    <div key={etf.id} className="animate-fade-in">
                      <ETFCard 
                        etf={etf} 
                        onRemove={removeEtf}
                        livePrice={prices[etf.id]}
                        exchangeRate={exchangeRate}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 차트 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">수익률 그래프</h2>
              <div className="h-64">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            {/* 종목별 비중 그래프 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition mt-6">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">종목별 비중</h2>
              <div className="h-72">
                <canvas ref={pieChartRef}></canvas>
              </div>
            </div>
        </div>

        {/* ✅ 배당 관리 탭 */}
        <div className={activeTab === 'dividend' ? '' : 'hidden'}>
            {/* 배당 요약 카드 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">💰 배당 현황 요약</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">연간 예상 총 배당금</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-300">{formatNumber(Math.round(dividendCalculated.totalAnnualNet))} 원</p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                    세전: {formatNumber(Math.round(dividendCalculated.totalAnnualKrw))} 원 
                    {dividendCalculated.totalAnnualUsd > 0 && ` (${dividendCalculated.totalAnnualUsd.toFixed(2)} $)`}
                    | 세금 15.4% 차감
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">월평균 예상 배당금</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-300">{formatNumber(Math.round(dividendCalculated.monthlyAvg))} 원</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">등록 배당 종목</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-300">{dividendList.length} 개</p>
                </div>
              </div>
            </div>

            {/* 월별 배당 그래프 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">📊 월별 예상 배당금</h2>
              <div className="h-64">
                <canvas ref={dividendChartRef}></canvas>
              </div>
            </div>

            {/* 배당 종목 추가 폼 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">➕ 배당 종목 추가</h2>
              
              {/* ✅ 배당 종목 입력 폼 - Flex 한줄 정렬 (픽셀 단위 높이 완벽 일치) */}
              <div className="flex flex-wrap items-end gap-3 mb-4">
                {/* 종목 선택 */}
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">종목 선택</label>
                  <ETFSelector
                    value={newDividend.selectedETF}
                    onChange={(etf) => {
                      const currency = etf.category === '미국' ? 'USD' : 'KRW';
                      setNewDividend({
                        ...newDividend,
                        selectedETF: etf,
                        name: etf.name,
                        ticker: etf.ticker,
                        currency: currency
                      });
                    }}
                    placeholder="배당 종목을 검색하거나 선택하세요"
                    className="h-[42px] box-border"
                  />
                </div>

                {/* 주당 배당금 */}
                <div className="w-32">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">주당 배당금</label>
                  <div className="relative h-[42px]">
                    <input
                      type="number"
                      placeholder="0"
                      step={newDividend.currency === 'USD' ? "0.01" : "1"}
                      value={newDividend.dividendPerShare}
                      onChange={(e) => setNewDividend({...newDividend, dividendPerShare: parseFloat(e.target.value) || 0})}
                      className="w-full h-full box-border bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-0 pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-medium">
                      {newDividend.currency === 'USD' ? '$' : '원'}
                    </span>
                  </div>
                </div>

                {/* 보유 수량 */}
                <div className="w-32">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">보유 수량</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newDividend.quantity}
                    onChange={(e) => setNewDividend({...newDividend, quantity: parseInt(e.target.value) || 0})}
                    className="w-full h-[42px] box-border bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-0"
                  />
                </div>

                {/* 추가 버튼 */}
                <button
                  type="button"
                  onClick={addDividendItem}
                  className="h-[42px] px-6 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition flex-shrink-0 flex items-center justify-center box-border"
                >
                  추가
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-2">배당월 선택</label>
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                    <button
                      key={month}
                      onClick={() => toggleDividendMonth(month)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        newDividend.dividendMonths.includes(month)
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {month}월
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 배당 종목 리스트 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">📋 등록된 배당 종목</h2>
              
              {dividendList.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">등록된 배당 종목이 없습니다. 위 폼에서 추가해주세요</p>
              ) : (
                <div className="space-y-3">
                  {dividendList.map(item => (
                    <div key={item.id} className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.ticker} | {item.quantity} 주 | 
                          주당 {item.currency === 'USD' 
                            ? `$${item.dividendPerShare.toFixed(2)}` 
                            : `${formatNumber(item.dividendPerShare)} 원`}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">배당월: {item.dividendMonths.map(m => `${m}월`).join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">회당 수령액</p>
                        <p className="font-bold text-amber-600 dark:text-amber-400">
                          {item.currency === 'USD' 
                            ? `$${(item.dividendPerShare * item.quantity).toFixed(2)}` 
                            : `${formatNumber(item.dividendPerShare * item.quantity)} 원`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeDividendItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>

        {/* ✅ 아이 자산 현황 탭 */}
        <div className={activeTab === 'kids' ? '' : 'hidden'}>
            {/* 총 현황 카드 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">👶 아이 자산 현황</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">총 투자금액</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">{formatNumber(kidsTotalData.totalBuy)} 원</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">총 현재금액</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">{formatNumber(kidsTotalData.totalCurrent)} 원</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">총 수익금</p>
                  <p className={`text-xl font-bold ${kidsTotalData.totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {kidsTotalData.totalProfit >= 0 ? '+' : ''}{formatNumber(kidsTotalData.totalProfit)} 원
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">총 수익률</p>
                  <p className={`text-xl font-bold ${kidsTotalData.totalReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {kidsTotalData.totalReturn >= 0 ? '+' : ''}{kidsTotalData.totalReturn} %
                  </p>
                </div>
              </div>
            </div>

            {/* 아이 자산 ETF 추가 폼 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">아이 자산 ETF 추가</h2>
              <form onSubmit={addKidsEtf} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">종목 선택</label>
                  <ETFSelector
                    value={newKidsEtf.selectedETF}
                    onChange={(etf) => setNewKidsEtf({...newKidsEtf, selectedETF: etf})}
                    placeholder="아이 자산 ETF를 검색하거나 선택하세요"
                    className="h-[42px] box-border"
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">매수단가</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newKidsEtf.buyPrice}
                    onChange={(e) => setNewKidsEtf({...newKidsEtf, buyPrice: e.target.value})}
                    className="w-full h-[42px] box-border bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-0"
                    required
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">수량</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newKidsEtf.quantity}
                    onChange={(e) => setNewKidsEtf({...newKidsEtf, quantity: e.target.value})}
                    className="w-full h-[42px] box-border bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-0"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="h-[42px] px-6 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition flex-shrink-0 flex items-center justify-center"
                >
                  추가
                </button>
              </form>
            </div>

            {/* 아이 자산 ETF 목록 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mb-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">아이 보유 ETF 목록</h2>
              {kidsEtfs.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">등록된 ETF가 없습니다. 위 폼에서 추가해주세요</p>
              ) : (
                <div className="space-y-4">
                  {kidsEtfs.slice().reverse().map((etf) => (
                    <div key={etf.id} className="animate-fade-in">
                      <ETFCard 
                        etf={etf} 
                        onRemove={removeKidsEtf}
                        livePrice={prices[etf.id]}
                        exchangeRate={exchangeRate}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ✅ 증여세 면제 한도 트래커 */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800">
              <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 mb-4">📝 증여세 면제 한도</h3>
              
              {(() => {
                const GIFT_LIMIT = 20000000;
                const totalGift = kidsTotalData.totalBuy;
                const percentage = Math.min((totalGift / GIFT_LIMIT) * 100, 100);
                const remaining = Math.max(GIFT_LIMIT - totalGift, 0);
                
                let barColor = 'bg-emerald-500';
                if (percentage >= 90) barColor = 'bg-red-500';
                else if (percentage >= 70) barColor = 'bg-amber-500';

                return (
                  <>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-slate-700 dark:text-slate-300">현재 증여액</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(kidsTotalData.totalBuy)} 원</span>
                    </div>

                    <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${barColor} transition-all duration-700 ease-out rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between mt-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        잔여 한도: <span className="font-semibold">{formatNumber(remaining)} 원</span> 남음
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{percentage.toFixed(1)} %</span>
                    </div>

                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                      💡 미성년자 자녀 1인당 10년 합산 2천만 원까지 증여세가 면제됩니다.
                    </p>
                  </>
                );
              })()}
            </div>

            {/* ✅ 미래 자산 계산기 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6 mt-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">📈 10년 미래 자산 계산기</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">예상 연 수익률 (%)</label>
                  <input
                    type="number"
                    value={futureAssetParams.expectedRate}
                    onChange={(e) => setFutureAssetParams({...futureAssetParams, expectedRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">매월 추가 투자금액 (원)</label>
                  <input
                    type="number"
                    value={futureAssetParams.monthlyInvestment}
                    onChange={(e) => setFutureAssetParams({...futureAssetParams, monthlyInvestment: parseInt(e.target.value) || 0})}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">10년 후 예상 자산</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">{formatNumber(futureAssetData.finalAmount)} 원</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 투자금액</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{formatNumber(futureAssetData.totalInvestment)} 원</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-400">예상 수익금</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-300">+ {formatNumber(futureAssetData.expectedProfit)} 원</p>
                </div>
              </div>

              <div className="h-64">
                <canvas ref={futureAssetChartRef}></canvas>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
                ✅ 현재 원금을 기반으로 매월 복리 계산 / 세금 및 수수료는 포함되지 않은 예상치입니다
              </p>
            </div>
        </div>

        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-8"> ETF 실시간 대시보드</p>
      </div>
    </div>
  );
}

export default App
