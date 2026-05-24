# Final 3rd Soccer — Conversion Tracking

## Project Overview

Build a Vercel serverless function that acts as a secure proxy between the Final 3rd Soccer thank-you page and the Momence API. The function authenticates with Momence using staff credentials, looks up a session by ID, returns the session name, and the thank-you page uses that name to map to a hardcoded price for conversion tracking (Google Analytics via GTM and Meta Pixel).

## Background

- **Client site:** https://www.final3rdsoccer.com (Webflow)
- **Booking platform:** Momence (https://momence.com)
- **Problem:** Momence bookings happen on momence.com, not on the client site. After a successful purchase, Momence redirects to a custom tracking URL with URL params but no transaction value.
- **Redirect URL format:** `https://www.final3rdsoccer.com/thank-you?type=session&sessionId=134125149`
- **Momence API docs:** https://api.docs.momence.com/

## What Needs to Be Built

### 1. Vercel Serverless Function (`/api/session`)

A Vercel serverless function deployed as a standalone plain Node.js project that:

1. Accepts a GET request with a `sessionId` query param: `/api/session?id=134125149`
2. Authenticates with the Momence API using OAuth2 Password Flow
3. Calls `GET https://api.momence.com/api/v2/host/sessions/{sessionId}`
4. Returns the session `name` as JSON: `{ "name": "High Performance Training" }`
5. Caches the access token between invocations using a module-level variable (Vercel functions stay warm between requests)
6. Handles errors gracefully (invalid session, auth failure etc.)

**Project structure:**
```
/api
  session.js     # Vercel serverless function
vercel.json      # Vercel config
package.json
```

**`vercel.json`:**
```json
{
  "rewrites": [{ "source": "/api/session", "destination": "/api/session.js" }]
}
```

**Authentication flow:**

```
POST https://api.momence.com/api/v2/auth/token
Content-Type: application/json

{
  "grant_type": "password",
  "username": "MOMENCE_USERNAME",
  "password": "MOMENCE_PASSWORD",
  "client_id": "MOMENCE_CLIENT_ID",
  "client_secret": "MOMENCE_CLIENT_SECRET"
}
```

Returns `access_token` and `refresh_token`. Use `Authorization: Bearer {access_token}` on subsequent requests.

**Session detail endpoint:**

```
GET https://api.momence.com/api/v2/host/sessions/{sessionId}
Authorization: Bearer {access_token}
```

Returns session object including `name` field (e.g. `"High Performance Soccer Training"`).

**Environment variables (set in Vercel dashboard → Project Settings → Environment Variables):**
- `MOMENCE_USERNAME` — staff account email (your login, invited to F3rd's account)
- `MOMENCE_PASSWORD` — staff account password
- `MOMENCE_CLIENT_ID` — from F3rd's Momence dashboard: Settings → Apps & Integrations → Developer API
- `MOMENCE_CLIENT_SECRET` — same location

**Token caching:**
Use a module-level variable in the serverless function to cache the access token and expiry between warm invocations. On each request, check if the token is still valid before re-authenticating. Use the refresh token flow when the access token expires:

```
POST https://api.momence.com/api/v2/auth/token
{
  "grant_type": "refresh_token",
  "refresh_token": "STORED_REFRESH_TOKEN",
  "client_id": "MOMENCE_CLIENT_ID",
  "client_secret": "MOMENCE_CLIENT_SECRET"
}
```

**CORS:** Allow `https://www.final3rdsoccer.com` only. Staging (`f3rd.webflow.io`) is excluded — conversion tracking runs on production only.

**Function URL:** Once deployed, the function will be available at `https://your-project.vercel.app/api/session`. Update the `fetch` call in the Webflow code below to use this URL.

---

### 2. Webflow Thank-You Page Custom Code

Add the following to the **`<head>` custom code of the `/thank-you` page only** in Webflow (Page Settings → Custom Code → Head Code):

```html
<script>
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const sessionId = params.get('sessionId');

    // Name-to-price map — update as new products are added
    const priceMap = {
      'High Performance Soccer Training': 70,
      // 'Private Training': 150,
      // '20 Session Package': 199,
    };

    let value = 0;

    if (type === 'session' && sessionId) {
      try {
        const res = await fetch(`https://your-project.vercel.app/api/session?id=${sessionId}`);
        const data = await res.json();
        const name = data.name || '';

        // Match against known program names (partial match for safety)
        for (const [key, price] of Object.entries(priceMap)) {
          if (name.toLowerCase().includes(key.toLowerCase())) {
            value = price;
            break;
          }
        }
      } catch (e) {
        console.warn('Momence session lookup failed, falling back to type-based value');
        // Fallback: use type-based pricing if API call fails
        const typeMap = { 'session': 70 };
        value = typeMap[type] || 0;
      }
    } else if (type === 'membership') {
      value = 0; // update when membership tracking is added
    }

    // Push to GTM data layer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'purchase',
      value: value,
      currency: 'CAD'
    });

    // Fire Meta Purchase event
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Purchase', {
        currency: 'CAD',
        value: value
      });
    }
  })();
</script>
```

---

### 3. GTM Configuration

In the GTM container (`GTM-5QDWR75C`):

- **Update the existing Purchase tag** (GA4 Event, Measurement ID `G-P7YLQD4QF4`):
  - Change the trigger from the current Custom Event (`Purchase Event Trigger`) to a new **Custom Event trigger** that fires on `event` = `purchase` (matching the dataLayer push above)
  - The existing event parameters (`value`, `currency`) can stay but update their variable source to read from the dataLayer: `dataLayer` variable → `value` and `currency`

---

## Current State

- ✅ Momence tracking URL field exists: Settings → General Setup → Checkout Purchase Tracking
- ✅ GTM container (`GTM-5QDWR75C`) added to Webflow via Apps & Integrations (loads sitewide)
- ✅ Meta Pixel ID (`1632640191332885`) added to Webflow via Apps & Integrations (fires PageView sitewide)
- ✅ Thank-you page exists at `https://www.final3rdsoccer.com/thank-you`
- ✅ Existing GTM tag: GA4 Purchase event with Data Layer variables (needs trigger updated)
- ⬜ Vercel serverless function not yet built
- ⬜ Webflow thank-you page custom code not yet added
- ⬜ Momence API client not yet created (needed for `client_id` / `client_secret`)
- ⬜ Momence tracking URL not yet set to `https://www.final3rdsoccer.com/thank-you`

## Products & Pricing (Webflow CMS)

Pricing is managed in Webflow so the client can add/edit products without touching code.

### CMS Collection: `Conversion Products`

Create a collection in Webflow with these fields:

| Field | Type | Slug | Example | Notes |
|---|---|---|---|---|
| Name | Plain text | `name` | High Performance Summer Camp | Display name for the client |
| Match text | Plain text | `match-text` | Summer Camp | Partial text to match Momence session names |
| Price | Number | `price` | 325 | Conversion value in CAD |
| Priority | Number | `priority` | 10 | Higher = checked first (use for specific vs broad matches) |
| Active | Switch | `active` | On | Turn off without deleting |

**Client workflow:** CMS → Conversion Products → Add/edit row → Publish site.

The Vercel function reads **published (live)** items from this collection and caches them for 5 minutes.

**Match text tips for the client:**
- Use a unique phrase from the Momence booking name
- `"Summer Camp"` matches `"High Performance Summer Camp 1"`
- `"High Performance Training"` matches weekly training sessions
- More specific match text + higher priority wins when names overlap

### Vercel env vars for Webflow

- `WEBFLOW_API_TOKEN` — Site token with `CMS:read` scope ([Webflow API settings](https://webflow.com/dashboard/account/integrations))
- `WEBFLOW_COLLECTION_ID` — Collection ID from Webflow CMS settings

If Webflow is not configured, a code fallback list in `lib/price-map.js` is used.

---

## Products in Scope (Current)

| Product | Match text | Price (CAD) |
|---|---|---|
| High Performance Summer Camp | `Summer Camp` | $325 |
| High Performance Training | `High Performance Training` | $70 |
| 20 Session Package | TBC | TBD |
| Private Training | TBC | TBD |

## Notes

- The `sessionId` in the URL is a per-occurrence ID (each class instance has a unique ID), not a stable product ID. That's why we look up the session name via the API and map by name instead.
- If the Vercel function call fails, the code falls back to `type`-based pricing so tracking still fires.
- Momence does **not** pass transaction value in the redirect URL params — only `type` and `type-specific ID`.
- The redirect only fires for: classes, appointments, subscriptions, and packages. It does **not** fire for product or on-demand content purchases.
- Add `<meta name="robots" content="noindex">` to the thank-you page head to prevent search indexing.