const { getSession } = require('../lib/momence');
const { mapSessionNameToValue } = require('../lib/price-map');

const ALLOWED_ORIGIN = 'https://www.final3rdsoccer.com';

function corsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (origin === ALLOWED_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    if (origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
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
    return res.status(200).json({
      name,
      value: mapSessionNameToValue(name),
      currency: 'CAD',
    });
  } catch (error) {
    console.error('Session lookup error:', error);

    return res.status(502).json({
      error: 'Failed to look up session',
    });
  }
};
