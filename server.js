const express = require('express');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── SET API proxy ──────────────────────────────────────────────────────────────
const SET_BASE = 'https://www.set.or.th';
const jar = new CookieJar();
const setClient = wrapper(axios.create({
  baseURL: SET_BASE,
  jar,
  withCredentials: true,
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'th,en-US;q=0.9,en;q=0.8',
    'X-Requested-With': 'XMLHttpRequest',
  }
}));

let sessionReady = false;

async function ensureSession() {
  if (sessionReady) return;
  try {
    await setClient.get('/th/home', {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
    });
    sessionReady = true;
    console.log('[SET] Session initialised');
  } catch (e) {
    console.error('[SET] Session init failed:', e.message);
  }
}

// Utility: proxy a SET API call
async function setProxy(url, referer, res) {
  await ensureSession();
  try {
    const response = await setClient.get(url, {
      headers: { Referer: `${SET_BASE}${referer}` }
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: err.message };
    res.status(status).json(data);
  }
}

// ── ROUTES ─────────────────────────────────────────────────────────────────────

// Top rankings: type = mostActiveValue | mostActiveVolume | topGainer | topLoser
app.get('/api/ranking/:type', async (req, res) => {
  const { type } = req.params;
  const count = parseInt(req.query.count) || 10;
  const market = req.query.market || 'SET';
  const secType = req.query.securityType || 'S';
  await setProxy(
    `/api/set/ranking/${type}/${market}/${secType}?count=${count}`,
    '/th/market/product/stock/top-ranking',
    res
  );
});

// Stock info (current price + key stats)
app.get('/api/stock/:symbol/info', async (req, res) => {
  const { symbol } = req.params;
  await setProxy(
    `/api/set/stock/${symbol.toUpperCase()}/info`,
    `/th/market/product/stock/quote/${symbol.toUpperCase()}/price`,
    res
  );
});

// Stock historical trading (OHLCV daily)
app.get('/api/stock/:symbol/history', async (req, res) => {
  const { symbol } = req.params;
  const { start, end, granularity = 'D' } = req.query;
  const endDate = end || new Date().toISOString().split('T')[0];
  const startDate = start || (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  })();
  await setProxy(
    `/api/set/stock/${symbol.toUpperCase()}/historical-trading?granularity=${granularity}&start=${startDate}&end=${endDate}&prior=false`,
    `/th/market/product/stock/quote/${symbol.toUpperCase()}/price`,
    res
  );
});

// DW list for a given underlying stock
app.get('/api/stock/:symbol/dw', async (req, res) => {
  const { symbol } = req.params;
  await setProxy(
    `/api/set/dw-info/list?underlyingSymbol=${symbol.toUpperCase()}&lang=th`,
    `/th/market/product/stock/quote/${symbol.toUpperCase()}/price`,
    res
  );
});

// DW info for a single DW symbol
app.get('/api/dw/:symbol/info', async (req, res) => {
  const { symbol } = req.params;
  await setProxy(
    `/api/set/dw/${symbol.toUpperCase()}/info`,
    `/th/market/product/dw/quote/${symbol.toUpperCase()}/price`,
    res
  );
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`StockThai running at http://localhost:${PORT}`);
  await ensureSession();
});
