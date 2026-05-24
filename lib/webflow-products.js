const WEBFLOW_API_BASE = 'https://api.webflow.com/v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {{ products: Array<{ name: string, matchText: string, value: number, priority: number }> | null, fetchedAt: number | null }} */
let cache = { products: null, fetchedAt: null };

function isConfigured() {
  return Boolean(
    process.env.WEBFLOW_API_TOKEN && process.env.WEBFLOW_COLLECTION_ID
  );
}

function parseFieldData(item) {
  const fields = item.fieldData || {};
  const matchText =
    fields['match-text'] || fields['matchText'] || fields.name || '';
  const price = Number(fields.price);
  const priority = Number(fields.priority || fields['sort-order'] || 0);
  const active = fields.active !== false && fields.active !== 'false';

  if (!active || !matchText || Number.isNaN(price)) {
    return null;
  }

  return {
    name: fields.name || matchText,
    matchText: String(matchText).trim(),
    value: price,
    priority: Number.isNaN(priority) ? 0 : priority,
  };
}

async function fetchAllLiveItems() {
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const token = process.env.WEBFLOW_API_TOKEN;
  const items = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${WEBFLOW_API_BASE}/collections/${collectionId}/items/live?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Webflow CMS fetch failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    items.push(...(data.items || []));

    const total = data.pagination?.total ?? items.length;
    offset += limit;
    if (offset >= total) break;
  }

  return items
    .map(parseFieldData)
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);
}

async function getProducts() {
  if (!isConfigured()) {
    return null;
  }

  const isFresh =
    cache.products &&
    cache.fetchedAt &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS;

  if (isFresh) {
    return cache.products;
  }

  const products = await fetchAllLiveItems();
  cache = { products, fetchedAt: Date.now() };
  return products;
}

module.exports = { getProducts, isConfigured };
