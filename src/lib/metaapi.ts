const TOKEN = process.env.METAAPI_TOKEN || '';
const PROVISIONING = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

function headers() {
  return {
    'auth-token': TOKEN,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function clientBase(region?: string | null) {
  return `https://mt-client-api-v1.${region || 'new-york'}.agiliumtrade.ai`;
}

export async function createMetaApiAccount(input: {
  login: string;
  password: string;
  server: string;
  name: string;
}) {
  if (!TOKEN) throw new Error('Falta METAAPI_TOKEN');
  const res = await fetch(`${PROVISIONING}/users/current/accounts`, {
    method: 'POST',
    headers: {
      ...headers(),
      'transaction-id': crypto.randomUUID().replace(/-/g, ''),
    },
    body: JSON.stringify({
      name: input.name,
      login: input.login,
      password: input.password,
      server: input.server,
      platform: 'mt5',
      magic: 1000,
      type: 'cloud-g2',
      region: 'new-york',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    throw new Error(data.message || data.error || `MetaApi ${res.status}`);
  }
  return data as { id?: string; _id?: string; state?: string; region?: string };
}

export async function deployMetaApiAccount(accountId: string) {
  const res = await fetch(`${PROVISIONING}/users/current/accounts/${accountId}/deploy`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok && res.status !== 204 && res.status !== 202) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Deploy ${res.status}`);
  }
}

export async function getMetaApiAccount(accountId: string) {
  const res = await fetch(`${PROVISIONING}/users/current/accounts/${accountId}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getAccountInformation(accountId: string, region?: string | null) {
  const res = await fetch(
    `${clientBase(region)}/users/current/accounts/${accountId}/account-information`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`MetaApi info ${res.status}`);
  return res.json();
}

export async function getPositions(accountId: string, region?: string | null) {
  const res = await fetch(
    `${clientBase(region)}/users/current/accounts/${accountId}/positions`,
    { headers: headers() }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getDeals(accountId: string, region?: string | null, start?: string) {
  const from = start || new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
  const to = new Date().toISOString();
  const res = await fetch(
    `${clientBase(region)}/users/current/accounts/${accountId}/history-deals/time/${from}/${to}`,
    { headers: headers() }
  );
  if (!res.ok) return [];
  return res.json();
}
