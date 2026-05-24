const { getProducts, isConfigured } = require('./webflow-products');

/**
 * Fallback used when Webflow CMS is not configured or temporarily unavailable.
 */
const FALLBACK_PRODUCTS = [
  { name: 'High Performance Summer Camp', matchText: 'Summer Camp', value: 325, priority: 10 },
  { name: 'High Performance Training', matchText: 'High Performance Training', value: 70, priority: 5 },
];

async function loadProducts() {
  if (isConfigured()) {
    try {
      const products = await getProducts();
      if (products?.length) return products;
    } catch (error) {
      console.error('Webflow product load failed, using fallback:', error);
    }
  }

  return FALLBACK_PRODUCTS;
}

/**
 * @param {string} sessionName
 * @returns {Promise<number>}
 */
async function mapSessionNameToValue(sessionName) {
  const products = await loadProducts();
  const normalized = sessionName.toLowerCase();

  for (const product of products) {
    if (normalized.includes(product.matchText.toLowerCase())) {
      return product.value;
    }
  }

  return 0;
}

module.exports = { FALLBACK_PRODUCTS, mapSessionNameToValue, loadProducts };
