/**
 * Maps Momence session names to conversion values (CAD).
 * Used by the Webflow thank-you page for GTM / Meta tracking.
 */
const PRICE_MAP = {
  'High Performance Training': 70,
  'High Performance Soccer Training': 70,
  // 'Private Training': 150,
  // '20 Session Package': 199,
};

/**
 * @param {string} sessionName
 * @returns {number}
 */
function mapSessionNameToValue(sessionName) {
  const normalized = sessionName.toLowerCase();

  for (const [key, price] of Object.entries(PRICE_MAP)) {
    if (normalized.includes(key.toLowerCase())) {
      return price;
    }
  }

  return 0;
}

module.exports = { PRICE_MAP, mapSessionNameToValue };
