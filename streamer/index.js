const express = require('express');
const io = require('socket.io-client');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const METAAPI_TOKEN = process.env.METAAPI_TOKEN || '';
const STREAM_SECRET = process.env.STREAM_SECRET || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://cuenta.orzfunding.com';
const POLL_MS = 100;

function sign(accountId) {
  return crypto.createHmac('sha256', STREAM_SECRET).update(accountId).digest('hex');
}

function verify(accountId, token) {
  if (!STREAM_SECRET || !accountId || !token) return false;
  const expected = sign(accountId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

const pools = new Map();

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'auth-token': METAAPI_TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function getPool(accountId, region) {
  const key = `${accountId}:${region || 'new-york'}`;
  if (pools.has(key)) return pools.get(key);

  const base = `https://mt-client-api-v1.${region || 'new-york'}.agiliumtrade.ai`;
  const pool = {
    clients: new Set(),
    balance: 0,
    equity: 0,
    positions: [],
    timer: null,
    busy: false,
    socket: null,
  };

  async function tick() {
    if (pool.busy || pool.clients.size === 0) return;
    pool.busy = true;
    try {
      const [info, positions] = await Promise.all([
        fetchJson(`${base}/users/current/accounts/${accountId}/account-information`),
        fetchJson(`${base}/users/current/accounts/${accountId}/positions`),
      ]);
      pool.balance = Number(info.balance || 0);
      pool.equity = Number(info.equity || 0);
      pool.positions = Array.isArray(positions) ? positions : [];
      broadcast(pool);
    } catch (e) {
      console.log('[stream] poll', accountId, e.message);
    } finally {
      pool.busy = false;
    }
  }

  function connectWs() {
    const socket = io(base, {
      path: '/ws',
      reconnection: true,
      query: { 'auth-token': METAAPI_TOKEN },
      transports: ['websocket'],
    });
    pool.socket = socket;
    socket.on('connect', () => {
      console.log('[stream] ws connected', accountId);
      socket.emit('request', {
        accountId,
        type: 'synchronize',
        requestId: crypto.randomUUID(),
        startingDealTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        startingHistoryOrderTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      });
    });
    socket.on('synchronization', (data) => {
      if (!data || data.accountId !== accountId) return;
      if (data.type === 'accountInformation' && data.accountInformation) {
        pool.balance = Number(data.accountInformation.balance || pool.balance);
        pool.equity = Number(data.accountInformation.equity || pool.equity);
        broadcast(pool);
      }
      if (data.type === 'positions' && Array.isArray(data.positions)) {
        pool.positions = data.positions;
        broadcast(pool);
      }
    });
    socket.on('connect_error', (err) => {
      console.log('[stream] ws error', accountId, err && err.message);
    });
  }

  pool.timer = setInterval(tick, POLL_MS);
  tick();
  connectWs();

  pools.set(key, pool);
  return pool;
}

function broadcast(pool) {
  const payload = {
    balance: pool.balance,
    equity: pool.equity,
    positions: pool.positions,
    ts: Date.now(),
  };
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of pool.clients) {
    try { res.write(line); } catch { /* ignore */ }
  }
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/stream', (req, res) => {
  const { accountId, token, region, initial, dailyStart, status } = req.query;
  if (!verify(String(accountId || ''), String(token || ''))) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.flushHeaders?.();

  const pool = getPool(String(accountId), String(region || 'new-york'));
  pool.clients.add(res);

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* ignore */ }
  };

  send({
    balance: pool.balance,
    equity: pool.equity,
    positions: pool.positions,
    initial: Number(initial || 0),
    dailyStart: Number(dailyStart || 0),
    status: String(status || 'active'),
    ts: Date.now(),
  });

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);

  req.on('close', () => {
    clearInterval(ping);
    pool.clients.delete(res);
    if (pool.clients.size === 0) {
      clearInterval(pool.timer);
      try { pool.socket && pool.socket.close(); } catch { /* ignore */ }
      pools.delete(`${accountId}:${region || 'new-york'}`);
    }
  });
});

app.listen(PORT, () => {
  console.log(`streamer on ${PORT}`);
});
