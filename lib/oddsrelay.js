'use strict';

// The HTTP side of the integration: the key on every request, readable errors, quote-first spending, and the
// helpers that turn API replies into the flat records Zapier works with.

const BASE_URL = 'https://api.oddsrelay.io';
const KEYS_PAGE = 'https://app.oddsrelay.io/dashboard/keys';
const PLANS_PAGE = 'https://oddsrelay.io/pricing';

/** The matched boards, by the names the OddsRelay site uses. `raw` is the unmatched feed, for coverage only. */
const FEED_TYPES = {
  standard: 'Standard',
  'each-way': 'Each-way',
  'extra-place': 'Extra place',
  bog: 'Best odds guaranteed (BOG)',
  dutching: 'Dutching',
  '2up': '2Up',
};
const RAW = { raw: 'Raw odds' };

// beforeRequest: the key as a Bearer token, gzip (the larger boards refuse uncompressed replies), JSON.
const addKey = (request, z, bundle) => {
  request.headers = { Accept: 'application/json', 'Accept-Encoding': 'gzip', ...request.headers };
  // A 429 is explained below, with its own message, instead of the platform's generic one.
  request.throwForThrottlingEarly = false;
  const key = String(bundle.authData.apiKey || '').trim();
  if (key && !request.keyless) request.headers.Authorization = `Bearer ${key}`;
  return request;
};

/** afterResponse: throws a readable error for any reply of 400 or above; returns the reply otherwise. */
const check = (response, z) => {
  if (response.status < 400) return response;
  let error = {};
  try {
    error = JSON.parse(response.content).error || {};
  } catch {
    // Some 429 and 502 replies have no JSON body.
  }
  const code = error.code || `http_${response.status}`;
  const ref = error.request_id ? ` (request ${error.request_id})` : '';

  if (response.status === 401) {
    throw new z.errors.ExpiredAuthError(
      `Your OddsRelay API key was not accepted (${code}). Copy your key from ${KEYS_PAGE} and connect your ` +
        `OddsRelay account again.${ref}`,
    );
  }
  if (response.status === 402) {
    const fallback =
      `This request costs ${error.cost} tokens and your OddsRelay account has ${error.remaining} left. Narrow the ` +
      `filters, or choose a plan at ${error.upgrade_url || PLANS_PAGE}.`;
    throw new z.errors.Error(`${error.message || fallback} Nothing was spent.${ref}`, code, 402);
  }
  if (response.status === 429) {
    const delay = Number(response.headers.get('retry-after')) || 60;
    throw new z.errors.ThrottledError(
      `OddsRelay is limiting requests from this key for a moment (${code}). Zapier will try again in ${delay} ` +
        `seconds. If this happens often, run the Zap less often.`,
      delay,
    );
  }
  const valid = Array.isArray(error.valid) && error.valid.length
    ? ` Accepted values: ${error.valid.slice(0, 40).join(', ')}${error.valid.length > 40 ? ', and more' : ''}.`
    : '';
  const message = error.message || `OddsRelay answered with HTTP ${response.status}. Please try again later.`;
  const err = new z.errors.Error(`${message}${valid}${ref}`, code, response.status);
  err.httpStatus = response.status; // a search turns a 404 into "nothing found"
  throw err;
};

/** A list field's values, whether Zapier passes an array or a mapped, comma-separated string. */
const list = (value) =>
  (Array.isArray(value) ? value : String(value ?? '').split(','))
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);

/** Query values as the API takes them: lists comma-joined, empty values left out. */
const query = (params) => {
  const out = {};
  for (const [name, value] of Object.entries(params)) {
    const v = list(value).join(',');
    if (v) out[name] = v;
  }
  return out;
};

/** GET a route and return its JSON body. */
const get = async (z, path, params = {}, options = {}) => {
  const response = await z.request({ url: BASE_URL + path, params: query(params), ...options });
  return response.data;
};

/**
 * GET a route that spends tokens, after pricing it with quote=true (free). Above maxTokens the request is not
 * made and nothing is spent.
 */
const spend = async (z, path, params, maxTokens) => {
  const quote = await get(z, path, { ...params, quote: 'true' });
  if (Number.isFinite(maxTokens) && quote.cost > maxTokens) {
    throw new z.errors.Error(
      `This request would cost ${quote.cost} tokens, above your limit of ${maxTokens}, so it was not made and ` +
        'nothing was spent. Narrow the filters (fewer sports, bookmakers or markets), or raise "Most tokens per run".',
      'over_token_limit',
      400,
    );
  }
  return get(z, path, params);
};

/** A readable name for an event: "Home v Away", else the event or course name. */
const eventName = (e) => {
  if (e.home_team && e.away_team) return `${e.home_team} v ${e.away_team}`;
  return e.event_name || e.venue || e.home_team || e.sport_title || e.event_id || e.id;
};

/** A coverage product's venues: bookmakers and exchanges are listed apart. */
const venues = (product) => [...(product?.bookmakers || []), ...(product?.exchanges || [])];

/** The lowest priced offer of a list sorted lowest first. */
const lowest = (offers) => (Array.isArray(offers) ? offers.find((o) => o.price != null) : undefined);

/**
 * A matched board as rows: one per bookmaker back price, beside the lowest exchange lay price for the same
 * selection (on each-way and extra-place, the win lay and the place lay). Every row carries every key, null where
 * a feed type has no such value, so all feed types share one record shape.
 */
const boardRows = (board, feedType) => {
  const rows = [];
  for (const event of board.data || []) {
    for (const market of event.markets || []) {
      for (const outcome of market.outcomes || []) {
        const split = outcome.lay && !Array.isArray(outcome.lay);
        const win = lowest(split ? outcome.lay.win : outcome.lay);
        const place = split ? lowest(outcome.lay.place) : undefined;
        for (const back of outcome.back || []) {
          if (back.price == null) continue;
          const line = outcome.point ?? null;
          rows.push({
            id: [event.event_id, market.key, outcome.name, line ?? '', back.bookmaker, back.dutch_id ?? ''].join('|'),
            feed_type: feedType,
            event_id: event.event_id,
            event_name: eventName(event),
            sport_key: event.sport_key,
            sport_title: event.sport_title,
            commence_time: event.commence_time ?? null,
            home_team: event.home_team ?? null,
            away_team: event.away_team ?? null,
            venue: event.venue ?? null,
            market: market.key,
            selection: outcome.name,
            line,
            bookmaker: back.bookmaker,
            back_price: back.price,
            back_link: back.link ?? null,
            places: back.places ?? null,
            place_fraction: back.place_fraction ?? null,
            dutch_id: back.dutch_id ?? null,
            lay_exchange: win?.exchange ?? null,
            lay_price: win?.price ?? null,
            lay_available: win?.available ?? null,
            lay_link: win?.link ?? null,
            place_lay_exchange: place?.exchange ?? null,
            place_lay_price: place?.price ?? null,
            place_lay_available: place?.available ?? null,
            place_lay_places: place?.places ?? null,
            board_time: board.meta?.processed_at ?? null,
          });
        }
      }
    }
  }
  return rows;
};

/** Latest kick-off first: new fixtures are usually added at the far end of the schedule. */
const latestFirst = (a, b) => String(b.commence_time ?? '').localeCompare(String(a.commence_time ?? ''));

module.exports = {
  BASE_URL,
  KEYS_PAGE,
  FEED_TYPES,
  RAW,
  addKey,
  check,
  list,
  query,
  get,
  spend,
  eventName,
  venues,
  boardRows,
  latestFirst,
};
