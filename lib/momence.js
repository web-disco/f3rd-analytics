const MOMENCE_API_BASE = 'https://api.momence.com';

/** @type {{ accessToken: string | null, refreshToken: string | null, expiresAt: number | null }} */
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

function getClientCredentials() {
  const clientId = process.env.MOMENCE_CLIENT_ID;
  const clientSecret = process.env.MOMENCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Momence API client credentials');
  }

  return { clientId, clientSecret };
}

function getStaffCredentials() {
  const username = process.env.MOMENCE_USERNAME;
  const password = process.env.MOMENCE_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing Momence staff credentials');
  }

  return { username, password };
}

function basicAuthHeader(clientId, clientSecret) {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * @param {Record<string, string>} params
 */
async function requestToken(params) {
  const { clientId, clientSecret } = getClientCredentials();
  const body = new URLSearchParams(params);

  const response = await fetch(`${MOMENCE_API_BASE}/api/v2/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Momence auth failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const accessToken = data.access_token || data.accessToken;
  const refreshToken = data.refresh_token || data.refreshToken;
  const expiresAtRaw = data.accessTokenExpiresAt;

  if (!accessToken) {
    throw new Error('Momence auth response missing access token');
  }

  const expiresAt = expiresAtRaw
    ? new Date(expiresAtRaw).getTime() - 60_000
    : Date.now() + 3_600_000;

  tokenCache = {
    accessToken,
    refreshToken: refreshToken || tokenCache.refreshToken,
    expiresAt,
  };

  return accessToken;
}

async function authenticate() {
  const { username, password } = getStaffCredentials();
  return requestToken({
    grant_type: 'password',
    username,
    password,
  });
}

async function refreshAccessToken() {
  if (!tokenCache.refreshToken) {
    return authenticate();
  }

  return requestToken({
    grant_type: 'refresh_token',
    refresh_token: tokenCache.refreshToken,
  });
}

async function getAccessToken() {
  const isValid =
    tokenCache.accessToken &&
    tokenCache.expiresAt &&
    Date.now() < tokenCache.expiresAt;

  if (isValid) {
    return tokenCache.accessToken;
  }

  if (tokenCache.refreshToken) {
    return refreshAccessToken();
  }

  return authenticate();
}

/**
 * @param {string | number} sessionId
 */
async function getSession(sessionId, retried = false) {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${MOMENCE_API_BASE}/api/v2/host/sessions/${sessionId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 401 && !retried) {
    tokenCache.accessToken = null;
    tokenCache.expiresAt = null;
    return getSession(sessionId, true);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Momence session lookup failed (${response.status}): ${detail}`);
  }

  return response.json();
}

module.exports = { getSession };
