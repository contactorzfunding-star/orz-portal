const METAAPI_TOKEN = process.env.METAAPI_TOKEN!;
const BASE_URL = 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai'; // example base, adjust to actual MetaApi endpoint

// Note: Actual MetaApi base URLs are region-specific, e.g. https://mt-client-api-v1.new-york.agiliumtrade.ai
// Use the one from your MetaApi dashboard.

export async function getAccountInformation(accountId: string) {
  const res = await fetch(`${BASE_URL}/users/current/accounts/${accountId}/account-information`, {
    headers: {
      'auth-token': METAAPI_TOKEN,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`MetaApi error: ${res.status}`);
  return res.json();
}

export async function getPositions(accountId: string) {
  const res = await fetch(`${BASE_URL}/users/current/accounts/${accountId}/positions`, {
    headers: { 'auth-token': METAAPI_TOKEN },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getHistoryDeals(accountId: string, startTime?: string) {
  const url = new URL(`${BASE_URL}/users/current/accounts/${accountId}/history-deals/time`);
  if (startTime) url.searchParams.set('startTime', startTime);
  const res = await fetch(url.toString(), {
    headers: { 'auth-token': METAAPI_TOKEN },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function listAccounts() {
  const res = await fetch(`${BASE_URL}/users/current/accounts`, {
    headers: { 'auth-token': METAAPI_TOKEN },
  });
  if (!res.ok) throw new Error('Failed to list MetaApi accounts');
  return res.json();
}