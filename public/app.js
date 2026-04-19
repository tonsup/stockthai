/* ═══════════════════════════════════════════════
   StockThai – Frontend App
   ═══════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  currentSymbol: null,
  history: [],          // full history (oldest → newest)
  filteredHistory: [],  // period-filtered
  priceChart: null,
  volumeChart: null,
  dwData: [],
  currentRankType: 'mostActiveValue',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = (n, d = 2) => (n == null ? '–' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtMillions = n => n == null ? '–' : (n / 1e6).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = iso => iso ? iso.split('T')[0] : '–';

function signClass(v) {
  if (v > 0) return 'up';
  if (v < 0) return 'dn';
  return 'nc';
}

function signStr(v, d = 2) {
  if (v == null) return '–';
  const s = v > 0 ? '+' : '';
  return `${s}${fmt(v, d)}`;
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LANDING – Top Rankings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadRanking(type) {
  state.currentRankType = type;
  const tbody = $('rankingBody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading">⏳ กำลังโหลด...</td></tr>';

  try {
    const data = await fetchJSON(`/api/ranking/${type}?count=10`);
    const stocks = data.stocks || [];

    // Market status bar
    if (data.marketDateTime) {
      $('marketStatusBar').innerHTML =
        `<span id="marketTime">ข้อมูล ณ ${new Date(data.marketDateTime).toLocaleString('th-TH')} | ตลาด: ${data.market || 'SET'}</span>`;
    }

    if (!stocks.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading">ไม่พบข้อมูล</td></tr>';
      return;
    }

    tbody.innerHTML = stocks.map((s, i) => {
      const cls = signClass(s.change);
      const vol = (s.totalVolume / 1e6).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const val = fmtMillions(s.totalValue);
      return `
        <tr onclick="showStock('${s.symbol}')">
          <td>${i + 1}</td>
          <td><span class="sym-link">${s.symbol}</span></td>
          <td class="${cls}">${fmt(s.last)}</td>
          <td class="${cls}">${signStr(s.change)}</td>
          <td class="${cls}">${signStr(s.percentChange)}%</td>
          <td>${fmt(s.high)}</td>
          <td>${fmt(s.low)}</td>
          <td>${Number(s.totalVolume).toLocaleString('th-TH')}</td>
          <td>${val}</td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STOCK DETAIL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function showStock(symbol) {
  symbol = symbol.trim().toUpperCase();
  state.currentSymbol = symbol;

  $('landing').classList.add('hidden');
  $('stockDetail').classList.remove('hidden');

  // Reset UI
  $('stockSymbol').textContent = symbol;
  $('stockName').textContent = '—';
  $('priceMain').textContent = '—';
  $('priceChange').textContent = '';
  $('statsGrid').innerHTML = '';
  $('fundGrid').innerHTML = '';
  $('taGrid').innerHTML = 'กำลังคำนวณ…';
  $('taStrategy').innerHTML = '';
  $('dwBody').innerHTML = '<tr><td colspan="17" class="loading">⏳ กำลังโหลด...</td></tr>';

  // Show chart pane by default
  switchDetailTab('paneChart');

  // Fetch info + history in parallel
  try {
    const [info, rawHistory] = await Promise.all([
      fetchJSON(`/api/stock/${symbol}/info`),
      fetchJSON(`/api/stock/${symbol}/history?granularity=D`),
    ]);

    // History: API returns newest→oldest, reverse to oldest→newest
    state.history = Array.isArray(rawHistory) ? rawHistory.slice().reverse() : [];

    renderStockHeader(info);
    renderStatsGrid(info);
    renderFundGrid(info);

    // Default 3-month period
    setChartPeriod(3);

    // Load DW in background
    loadDW(symbol);

  } catch (e) {
    $('statsGrid').innerHTML = `<p style="color:var(--red)">เกิดข้อผิดพลาด: ${e.message}</p>`;
  }
}

function renderStockHeader(info) {
  $('stockSymbol').textContent = info.symbol || state.currentSymbol;
  $('stockName').textContent = info.nameTH || info.nameEN || '';

  const cls = signClass(info.change);
  $('priceMain').textContent = fmt(info.last);
  $('priceMain').className = `price-main ${cls}`;
  $('priceChange').className = `price-change ${cls}`;
  $('priceChange').textContent =
    `${signStr(info.change)} (${signStr(info.percentChange)}%)  ณ ${fmtDate(info.marketDateTime)}`;
}

function renderStatsGrid(info) {
  const items = [
    ['ราคาเปิด', fmt(info.open)],
    ['สูงสุดวันนี้', fmt(info.high)],
    ['ต่ำสุดวันนี้', fmt(info.low)],
    ['ราคาเฉลี่ย', fmt(info.average)],
    ['ราคาปิดก่อนหน้า', fmt(info.prior)],
    ['52W สูง', fmt(info.high52Weeks)],
    ['52W ต่ำ', fmt(info.low52Weeks)],
    ['ปริมาณ (หุ้น)', Number(info.totalVolume || 0).toLocaleString('th-TH')],
    ['มูลค่า (ล้านบ.)', fmtMillions(info.totalValue)],
    ['Ceiling', fmt(info.ceiling)],
    ['Floor', fmt(info.floor)],
    ['Par', fmt(info.par)],
  ];
  $('statsGrid').innerHTML = items.map(([l, v]) => `
    <div class="stat-card">
      <div class="stat-label">${l}</div>
      <div class="stat-value">${v}</div>
    </div>`).join('');
}

function renderFundGrid(info) {
  const mc = info.marketCap ? (info.marketCap / 1e9).toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' พันล้าน' : '–';
  const items = [
    ['Market Cap (บ.)', mc],
    ['P/E Ratio', fmt(info.peRatio)],
    ['P/BV Ratio', fmt(info.pbRatio)],
    ['Dividend Yield', info.dividendYield ? fmt(info.dividendYield) + '%' : '–'],
    ['จำนวนหุ้น (ล้านหุ้น)', info.listedShare ? (info.listedShare / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 0 }) : '–'],
    ['NVDR Net Vol', info.nvdrNetVolume != null ? Number(info.nvdrNetVolume).toLocaleString('th-TH') : '–'],
    ['กลุ่มอุตสาหกรรม', info.industryName || '–'],
    ['กลุ่มธุรกิจ', info.sectorName || '–'],
    ['ตลาด', info.marketName || '–'],
  ];
  $('fundGrid').innerHTML = items.map(([l, v]) => `
    <div class="stat-card">
      <div class="stat-label">${l}</div>
      <div class="stat-value">${v}</div>
    </div>`).join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHART
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setChartPeriod(months) {
  document.querySelectorAll('.period-btn').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.months) === months)
  );
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  state.filteredHistory = state.history.filter(d => new Date(d.date) >= cutoff);
  renderCharts();
  renderTA();
}

function renderCharts() {
  const data = state.filteredHistory;
  if (!data.length) return;

  const labels = data.map(d => fmtDate(d.date));
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.totalVolume / 1e6);

  // Price chart
  if (state.priceChart) state.priceChart.destroy();
  const priceCtx = $('priceChart').getContext('2d');

  // MA lines
  const ma5 = calcSMA(closes, 5);
  const ma25 = calcSMA(closes, 25);
  const ma60 = closes.length >= 60 ? calcSMA(closes, 60) : [];

  // Gradient fill
  const gradient = priceCtx.createLinearGradient(0, 0, 0, 340);
  gradient.addColorStop(0, 'rgba(88,166,255,0.25)');
  gradient.addColorStop(1, 'rgba(88,166,255,0.02)');

  state.priceChart = new Chart(priceCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'ราคา',
          data: closes,
          borderColor: '#58a6ff',
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.1,
          order: 1,
        },
        {
          label: 'MA5',
          data: ma5,
          borderColor: '#f0e040',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
          order: 2,
        },
        {
          label: 'MA25',
          data: ma25,
          borderColor: '#e85c38',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
          order: 3,
        },
        ...(ma60.length ? [{
          label: 'MA60',
          data: ma60,
          borderColor: '#bc8cff',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
          order: 4,
        }] : []),
      ],
    },
    options: chartOptions('ราคา (บาท)'),
  });

  // Volume chart
  if (state.volumeChart) state.volumeChart.destroy();
  const volCtx = $('volumeChart').getContext('2d');
  const volColors = data.map((d, i) => {
    if (i === 0) return 'rgba(88,166,255,0.6)';
    return d.close >= d.prior ? 'rgba(63,185,80,0.6)' : 'rgba(248,81,73,0.6)';
  });
  state.volumeChart = new Chart(volCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'ปริมาณ (ล้านหุ้น)',
        data: volumes,
        backgroundColor: volColors,
        borderWidth: 0,
      }],
    },
    options: {
      ...chartOptions('ปริมาณ (ล้าน)'),
      plugins: { legend: { display: false } },
    },
  });
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#8b949e', boxWidth: 14, font: { size: 11 } },
        position: 'top',
      },
      tooltip: {
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#8b949e',
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#8b949e', maxTicksLimit: 10, font: { size: 11 } },
        grid: { color: '#21262d' },
      },
      y: {
        ticks: { color: '#8b949e', font: { size: 11 } },
        grid: { color: '#21262d' },
        title: { display: true, text: yLabel, color: '#8b949e', font: { size: 10 } },
      },
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TECHNICAL ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcSMA(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    return arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
  });
}

function calcEMA(arr, n) {
  const k = 2 / (n + 1);
  const result = new Array(arr.length).fill(null);
  let ema = null;
  for (let i = 0; i < arr.length; i++) {
    if (i < n - 1) continue;
    if (ema === null) {
      ema = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
      result[i] = ema;
    } else {
      ema = arr[i] * k + ema * (1 - k);
      result[i] = ema;
    }
  }
  return result;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12.map((v, i) => v != null && ema26[i] != null ? v - ema26[i] : null);
  const validMacd = macd.filter(v => v != null);
  const signal = calcEMA(validMacd, 9);
  const macdLast = macd[macd.length - 1];
  const signalLast = signal[signal.length - 1];
  return { macd: macdLast, signal: signalLast, histogram: macdLast != null && signalLast != null ? macdLast - signalLast : null };
}

function calcBollingerBands(closes, n = 20, k = 2) {
  if (closes.length < n) return null;
  const sma = calcSMA(closes, n);
  const last = closes.length - 1;
  const mid = sma[last];
  if (mid == null) return null;
  const slice = closes.slice(last - n + 1, last + 1);
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mid, 2), 0) / n;
  const std = Math.sqrt(variance);
  return { upper: mid + k * std, mid, lower: mid - k * std, std };
}

function calcADX(data, n = 14) {
  if (data.length < n + 2) return null;
  const trList = [], pdm = [], ndm = [];
  for (let i = 1; i < data.length; i++) {
    const { high, low, close } = data[i];
    const prevClose = data[i - 1].close;
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    trList.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    const up = high - prevHigh;
    const dn = prevLow - low;
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  const smooth = (arr, i) => i < n ? arr.slice(0, n).reduce((a, b) => a + b, 0) :
    smooth(arr, i - 1) - smooth(arr, i - 1) / n + arr[i];
  const last = trList.length - 1;
  const atr = smooth(trList, last);
  const pdi = (smooth(pdm, last) / atr) * 100;
  const ndi = (smooth(ndm, last) / atr) * 100;
  const dx = Math.abs(pdi - ndi) / (pdi + ndi) * 100;
  return { pdi, ndi, adx: dx };
}

function findSupportResistance(closes, lookback = 20) {
  const recent = closes.slice(-lookback);
  const sorted = [...recent].sort((a, b) => a - b);
  const step = Math.floor(sorted.length / 4);
  return {
    support1: sorted[step] || sorted[0],
    support2: sorted[0],
    resistance1: sorted[sorted.length - 1 - step] || sorted[sorted.length - 1],
    resistance2: sorted[sorted.length - 1],
  };
}

function overallSignal(signals) {
  let buy = 0, sell = 0;
  signals.forEach(s => {
    if (s.includes('buy') || s.includes('Buy')) buy++;
    if (s.includes('sell') || s.includes('Sell')) sell++;
  });
  if (buy > sell + 1) return { label: 'ซื้อ (Buy)', cls: 'sig-buy' };
  if (buy > sell) return { label: 'ซื้ออ่อนๆ', cls: 'sig-buy' };
  if (sell > buy + 1) return { label: 'ขาย (Sell)', cls: 'sig-sell' };
  if (sell > buy) return { label: 'ขายอ่อนๆ', cls: 'sig-sell' };
  return { label: 'เฉย (Neutral)', cls: 'sig-neutral' };
}

function renderTA() {
  const data = state.filteredHistory;
  if (!data.length) { $('taGrid').innerHTML = 'ไม่มีข้อมูล'; return; }

  const closes = data.map(d => d.close);
  const last = closes[closes.length - 1];

  // Indicators
  const sma5 = calcSMA(closes, 5);
  const sma25 = calcSMA(closes, 25);
  const sma60 = calcSMA(closes, 60);
  const ema12 = calcEMA(closes, 12);

  const ma5v = sma5[sma5.length - 1];
  const ma25v = sma25[sma25.length - 1];
  const ma60v = sma60[sma60.length - 1];
  const ema12v = ema12[ema12.length - 1];

  const rsi14 = calcRSI(closes.slice(-50), 14);
  const macd = calcMACD(closes.slice(-60));
  const bb = calcBollingerBands(closes, 20);
  const adx = calcADX(data.slice(-40));
  const sr = findSupportResistance(closes);

  // Signal helpers
  const maSig = (maVal, label) => {
    if (maVal == null) return { sig: 'N/A', cls: 'sig-neutral', label };
    return last > maVal
      ? { sig: 'เหนือ MA → Buy', cls: 'sig-buy', label }
      : { sig: 'ต่ำกว่า MA → Sell', cls: 'sig-sell', label };
  };
  const rsiSig = r => {
    if (r == null) return { sig: 'N/A', cls: 'sig-neutral' };
    if (r >= 70) return { sig: `Overbought (${fmt(r, 1)})`, cls: 'sig-sell' };
    if (r <= 30) return { sig: `Oversold (${fmt(r, 1)})`, cls: 'sig-buy' };
    return { sig: `Neutral (${fmt(r, 1)})`, cls: 'sig-neutral' };
  };
  const macdSig = m => {
    if (!m || m.histogram == null) return { sig: 'N/A', cls: 'sig-neutral' };
    return m.histogram > 0
      ? { sig: `Bullish (+${fmt(m.histogram, 4)})`, cls: 'sig-buy' }
      : { sig: `Bearish (${fmt(m.histogram, 4)})`, cls: 'sig-sell' };
  };
  const bbSig = b => {
    if (!b) return { sig: 'N/A', cls: 'sig-neutral' };
    if (last <= b.lower) return { sig: 'แตะ Lower Band → Oversold', cls: 'sig-buy' };
    if (last >= b.upper) return { sig: 'แตะ Upper Band → Overbought', cls: 'sig-sell' };
    return { sig: `Mid: ${fmt(b.mid)}  [${fmt(b.lower)} – ${fmt(b.upper)}]`, cls: 'sig-neutral' };
  };
  const adxSig = a => {
    if (!a) return { sig: 'N/A', cls: 'sig-neutral' };
    const trend = a.adx > 25 ? (a.pdi > a.ndi ? 'Uptrend' : 'Downtrend') : 'Sideways';
    const cls = a.adx > 25 ? (a.pdi > a.ndi ? 'sig-buy' : 'sig-sell') : 'sig-neutral';
    return { sig: `ADX ${fmt(a.adx, 1)} – ${trend}`, cls };
  };

  const ma5s = maSig(ma5v, 'MA5');
  const ma25s = maSig(ma25v, 'MA25');
  const ma60s = maSig(ma60v, 'MA60');
  const rsiS = rsiSig(rsi14);
  const macdS = macdSig(macd);
  const bbS = bbSig(bb);
  const adxS = adxSig(adx);

  const allSigs = [ma5s.sig, ma25s.sig, ma60s.sig, rsiS.sig, macdS.sig];
  const overall = overallSignal(allSigs);

  const cards = [
    { name: 'สัญญาณรวม', value: overall.label, cls: overall.cls },
    { name: 'MA5 (SMA)', value: `${fmt(ma5v)}`, hint: ma5s.sig, cls: ma5s.cls },
    { name: 'MA25 (SMA)', value: `${fmt(ma25v)}`, hint: ma25s.sig, cls: ma25s.cls },
    { name: 'MA60 (SMA)', value: `${fmt(ma60v)}`, hint: ma60s.sig, cls: ma60s.cls },
    { name: 'EMA12', value: `${fmt(ema12v)}`, cls: last >= ema12v ? 'sig-buy' : 'sig-sell' },
    { name: 'RSI (14)', value: rsiS.sig, cls: rsiS.cls },
    { name: 'MACD(12,26,9)', value: macd ? `${fmt(macd.macd, 3)} / Sig ${fmt(macd.signal, 3)}` : '–', hint: macdS.sig, cls: macdS.cls },
    { name: 'Bollinger Bands (20)', value: bb ? `${fmt(bb.lower)} – ${fmt(bb.upper)}` : '–', hint: bbS.sig, cls: bbS.cls },
    { name: 'ADX (14)', value: adx ? fmt(adx.adx, 1) : '–', hint: adxS.sig, cls: adxS.cls },
  ];

  $('taGrid').innerHTML = cards.map(c => `
    <div class="ta-card">
      <div class="ta-name">${c.name}</div>
      <div class="ta-value">${c.value}</div>
      ${c.hint ? `<div style="font-size:.75rem;color:var(--text2);margin-top:2px">${c.hint}</div>` : ''}
      <span class="ta-signal ${c.cls}">${c.cls.replace('sig-', '').replace('-', ' ').toUpperCase()}</span>
    </div>`).join('');

  // Strategy
  const trendDir = ma25v ? (last > ma25v ? 'ขาขึ้น' : 'ขาลง') : '?';
  const trendColor = trendDir === 'ขาขึ้น' ? 'var(--green)' : 'var(--red)';

  const shortTermView = () => {
    const signals = [];
    if (last > ma5v) signals.push('ราคาเหนือ MA5');
    else signals.push('ราคาต่ำกว่า MA5');
    if (rsi14 !== null) {
      if (rsi14 > 65) signals.push('RSI สูง – ระวัง Overbought');
      else if (rsi14 < 35) signals.push('RSI ต่ำ – โอกาส Oversold');
    }
    if (macd?.histogram > 0) signals.push('MACD เป็นบวก – momentum ดี');
    else if (macd?.histogram < 0) signals.push('MACD เป็นลบ – momentum อ่อน');
    return signals.join(', ');
  };

  const longTermView = () => {
    const signals = [];
    if (ma60v) {
      if (last > ma60v) signals.push('ราคาเหนือ MA60 – uptrend ระยะยาว');
      else signals.push('ราคาต่ำกว่า MA60 – แนวโน้มระยะยาวยังอ่อน');
    }
    if (adx?.adx > 25) signals.push(`ADX ${fmt(adx.adx, 1)} บ่งชี้ trend แข็งแกร่ง`);
    else signals.push('ADX ต่ำ – ตลาดเป็น sideways');
    return signals.join(', ');
  };

  $('taStrategy').innerHTML = `
    <h3>📊 สรุปกลยุทธ์: <span style="color:${trendColor}">${trendDir}</span></h3>
    <div class="strategy-section">
      <h4>Short-term (1–4 สัปดาห์)</h4>
      <p>${shortTermView()}</p>
    </div>
    <div class="strategy-section">
      <h4>Long-term (1–6 เดือน)</h4>
      <p>${longTermView()}</p>
    </div>
    <div class="strategy-section">
      <h4>แนวรับ-แนวต้าน (${Math.min(20, closes.length)} วันล่าสุด)</h4>
      <div class="sr-levels">
        <div class="sr-item support">
          <div class="sr-type">แนวรับ 1</div>
          <div class="sr-price up">${fmt(sr.support1)}</div>
        </div>
        <div class="sr-item support">
          <div class="sr-type">แนวรับ 2</div>
          <div class="sr-price up">${fmt(sr.support2)}</div>
        </div>
        <div class="sr-item resistance">
          <div class="sr-type">แนวต้าน 1</div>
          <div class="sr-price dn">${fmt(sr.resistance1)}</div>
        </div>
        <div class="sr-item resistance">
          <div class="sr-type">แนวต้าน 2</div>
          <div class="sr-price dn">${fmt(sr.resistance2)}</div>
        </div>
      </div>
    </div>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DW TABLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadDW(symbol) {
  try {
    const data = await fetchJSON(`/api/stock/${symbol}/dw`);
    state.dwData = data.dwList || [];
    renderDWTable('all');
  } catch (e) {
    $('dwBody').innerHTML = `<tr><td colspan="17" class="loading">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
  }
}

function renderDWTable(filter) {
  const list = filter === 'all' ? state.dwData : state.dwData.filter(d => d.dwType === filter);
  const tbody = $('dwBody');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="17" class="loading">ไม่พบ DW${filter !== 'all' ? ' (' + filter + ')' : ''}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(dw => {
    const cls = signClass(dw.change);
    const moneyBadge = dw.moneynessStatus === 'ITM'
      ? `<span class="badge badge-itm">ITM</span>`
      : dw.moneynessStatus === 'OTM'
        ? `<span class="badge badge-otm">OTM</span>`
        : `<span class="badge badge-atm">ATM</span>`;
    const typeBadge = dw.dwType === 'Call'
      ? `<span class="badge badge-call">Call</span>`
      : `<span class="badge badge-put">Put</span>`;
    const moneyPct = dw.moneynessPercent != null
      ? `${dw.moneynessStatus === 'ITM' ? '+' : '-'}${fmt(Math.abs(dw.moneynessPercent), 1)}%`
      : '–';
    return `
      <tr onclick="window.open('https://www.set.or.th/th/market/product/dw/quote/${dw.symbol}/price','_blank')">
        <td><span class="sym-link">${dw.symbol}</span></td>
        <td>${typeBadge}</td>
        <td>${dw.issuerSymbol || '–'}</td>
        <td class="${cls}">${fmt(dw.last)}</td>
        <td class="${cls}">${signStr(dw.percentChange)}%</td>
        <td>${fmt(dw.exercisePrice)}</td>
        <td style="font-size:.8rem">${dw.exerciseRatio || '–'}</td>
        <td>${moneyBadge}</td>
        <td class="${dw.moneynessStatus === 'ITM' ? 'up' : 'dn'}">${moneyPct}</td>
        <td>${fmt(dw.eg, 4)}</td>
        <td>${fmt(dw.delta, 4)}</td>
        <td>${dw.iv ? fmt(dw.iv, 2) + '%' : '–'}</td>
        <td>${dw.ttm != null ? dw.ttm + ' วัน' : '–'}</td>
        <td>${fmtDate(dw.firstTradingDate)}</td>
        <td>${fmtDate(dw.lastTradingDate)}</td>
        <td>${dw.listedShare ? Number(dw.listedShare).toLocaleString('th-TH') : '–'}</td>
        <td>${dw.percentOutstanding != null ? fmt(dw.percentOutstanding, 2) + '%' : '–'}</td>
      </tr>`;
  }).join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TAB SWITCHING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function switchDetailTab(paneId) {
  document.querySelectorAll('.detail-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.pane === paneId)
  );
  document.querySelectorAll('.detail-pane').forEach(p =>
    p.classList.toggle('hidden', p.id !== paneId)
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EVENT LISTENERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  loadRanking('mostActiveValue');

  // Ranking tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadRanking(btn.dataset.type);
    });
  });

  // Search
  const doSearch = () => {
    const sym = $('searchInput').value.trim();
    if (sym) showStock(sym);
  };
  $('searchBtn').addEventListener('click', doSearch);
  $('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Back button
  $('backBtn').addEventListener('click', () => {
    $('stockDetail').classList.add('hidden');
    $('landing').classList.remove('hidden');
    $('searchInput').value = '';
    state.currentSymbol = null;
    // Re-load current ranking
    loadRanking(state.currentRankType);
  });

  // Nav brand
  $('navBrand').addEventListener('click', () => {
    $('backBtn').click();
  });

  // Detail tabs
  document.querySelectorAll('.detail-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchDetailTab(btn.dataset.pane));
  });

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => setChartPeriod(Number(btn.dataset.months)));
  });

  // DW filter
  document.querySelectorAll('input[name="dwFilter"]').forEach(r => {
    r.addEventListener('change', e => renderDWTable(e.target.value));
  });
});
