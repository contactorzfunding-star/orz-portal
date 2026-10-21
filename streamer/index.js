const express = require('express');
const { io } = require('socket.io-client');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const METAAPI_TOKEN = process.env.METAAPI_TOKEN || '';
const STREAM_SECRET = process.env.STREAM_SECRET || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://cuenta.orzfunding.com';

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

function getPool(accountId, region) {
  const key = `${accountId}:${region || 'new-york'}`;
  if (pools.has(key)) return pools.get(key);

  const base = `https://mt-client-api-v1.${region || 'new-york'}.agiliumtrade.ai`;
  console.log('[stream] connecting', base, accountId);

  const socket = io(base, {
    path: '/ws',
    reconnection: true,
    query: { 'auth-token': METAAPI_TOKEN },
    transports: ['websocket', 'polling'],
  });

  const pool = {
    socket,
    clients: new Set(),
    balance: 0,
    equity: 0,
    positions: [],
    ready: false,
  };

  socket.on('connect', () => {
    console.log('[stream] connected', accountId);
    socket.emit('request', {
      accountId,
      type: 'synchronize',
      requestId: crypto.randomUUID(),
      startingDealTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      startingHistoryOrderTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    });
  });

  socket.on('synchronization', (data) => {
    if (!data || data.accountId !== accountId) return;
    console.log('[stream] event', data.type, accountId);
    if (data.type === 'accountInformation' && data.accountInformation) {
      pool.balance = Number(data.accountInformation.balance || 0);
      pool.equity = Number(data.accountInformation.equity || 0);
      pool.ready = true;
      broadcast(pool);
    }
    if (data.type === 'positions' && Array.isArray(data.positions)) {
      pool.positions = data.positions;
      pool.ready = true;
      broadcast(pool);
    }
    if (data.type === 'authenticated') {
      socket.emit('request', {
        accountId,
        type: 'synchronize',
        requestId: crypto.randomUUID(),
        startingDealTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        startingHistoryOrderTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[stream] disconnect', accountId, reason);
    pool.ready = false;
  });

  socket.on('connect_error', (err) => {
    console.log('[stream] error', accountId, err && err.message);
  });

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

  if (pool.ready) {
    send({
      balance: pool.balance,
      equity: pool.equity,
      positions: pool.positions,
      initial: Number(initial || 0),
      dailyStart: Number(dailyStart || 0),
      status: String(status || 'active'),
      ts: Date.now(),
    });
  }

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);

  req.on('close', () => {
    clearInterval(ping);
    pool.clients.delete(res);
    if (pool.clients.size === 0) {
      try { pool.socket.close(); } catch { /* ignore */ }
      pools.delete(`${accountId}:${region || 'new-york'}`);
    }
  });
});

app.listen(PORT, () => {
  console.log(`streamer on ${PORT}`);
});
