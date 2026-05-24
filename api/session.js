const { getSession } = require('../lib/momence');
const { mapSessionNameToValue } = require('../lib/price-map');

const ALLOWED_ORIGIN = 'https://www.final3rdsoccer.com';

function isAllowedOrigin(origin) {
  return origin === ALLOWED_ORIGIN;
}

function corsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

function applyCors(req, res) {
  const origin = req.headers.origin || '';

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.id || req.query.sessionId;

  if (!sessionId || !/^\d+$/.test(String(sessionId))) {
    return res
      .status(400)
      .setHeader('Content-Type', 'application/json')
      .json({ error: 'Missing or invalid session id' });
  }

  Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const name = session.name || '';
    const value = await mapSessionNameToValue(name);
    return res.status(200).json({
      name,
      value,
      currency: 'CAD',
    });
  } catch (error) {
    console.error('Session lookup error:', error);

    return res.status(502).json({
      error: 'Failed to look up session',
    });
  }
};
