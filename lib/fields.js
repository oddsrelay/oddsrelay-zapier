'use strict';

// Input fields shared by the triggers and searches, with their dropdowns. Every dropdown reads a free route.

const { FEED_TYPES, RAW, get, eventName, venues } = require('./oddsrelay');

const ACRONYMS = { mma: 'MMA' };
const sportName = (key) =>
  ACRONYMS[key] || key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Sport keys (soccer, tennis...) as the coverage route lists them. */
const sportKeys = async (z) => {
  const coverage = await get(z, '/v2/coverage');
  const keys = new Set();
  for (const product of Object.values(coverage.products || {})) {
    for (const venue of venues(product)) Object.keys(venue.sports || {}).forEach((s) => keys.add(s));
  }
  return [...keys].sort();
};

/** Each sport first (every competition in it), then the competitions, a page at a time. */
const sportChoices = async (z, bundle) => {
  const cursor = bundle.meta.paging_token || undefined;
  const results = cursor ? [] : (await sportKeys(z)).map((id) => ({ id, label: `${sportName(id)} (every competition)` }));
  const page = await get(z, '/v2/sports', { cursor });
  for (const s of page.data) results.push({ id: s.key, label: `${s.group}: ${s.title}` });
  return { results, paging_token: page.meta.next_cursor || null };
};

const sportOnlyChoices = async (z) => ({
  results: (await sportKeys(z)).map((id) => ({ id, label: sportName(id) })),
  paging_token: null,
});

/** The feed types this key can use, from its usage record. */
const feedTypeChoices = (withRaw) => async (z) => {
  const usage = await get(z, '/v2/usage');
  const allowed = new Set(usage.key?.products || []);
  const all = withRaw ? { ...FEED_TYPES, ...RAW } : FEED_TYPES;
  const results = Object.entries(all)
    .filter(([id]) => !allowed.size || allowed.has(id))
    .map(([id, label]) => ({ id, label }));
  return { results, paging_token: null };
};

/** Bookmakers, exchanges, or both (kind undefined), by name. */
const venueChoices = (kind) => async (z) => {
  const body = await get(z, '/v2/bookmakers');
  const results = body.data
    .filter((v) => kind === undefined || v.is_exchange === (kind === 'exchange'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({ id: v.key, label: v.name }));
  return { results, paging_token: null };
};

/** One feed type's market keys. Only the coverage route read without a key lists them. */
const marketChoices = async (z, bundle) => {
  const coverage = await get(z, '/v2/coverage', {}, { keyless: true });
  const markets = coverage.markets || {};
  const keys = markets[bundle.inputData.feed_type || 'raw'] || [...new Set(Object.values(markets).flat())].sort();
  return { results: keys.map((id) => ({ id, label: id })), paging_token: null };
};

/** One sport's events, a page at a time. */
const eventChoices = async (z, bundle) => {
  if (!bundle.inputData.sport) return { results: [], paging_token: null };
  const page = await get(z, '/v2/events', { sport: bundle.inputData.sport, cursor: bundle.meta.paging_token || undefined });
  const when = (t) => (typeof t === 'string' ? ` (${t.slice(0, 16).replace('T', ' ')} UTC)` : '');
  return {
    results: page.data.map((e) => ({ id: e.id, label: `${eventName(e)}${when(e.commence_time)}` })),
    paging_token: page.meta.next_cursor || null,
  };
};

const feedType = (withRaw = false) => ({
  key: 'feed_type',
  label: 'Feed type',
  required: true,
  altersDynamicFields: true,
  helpText: 'Only the feed types your API key can use are listed.',
  choices: { perform: feedTypeChoices(withRaw) },
});

/** The optional filters of a matched board, as the trigger and the search both take them after the required fields. */
const boardFilters = [
  {
    key: 'sports',
    label: 'Sports or competitions',
    list: true,
    helpText:
      'Pick a sport to include every competition in it, or single competitions. Leave empty for every sport, ' +
      'which costs more tokens.',
    choices: { perform: sportChoices },
  },
  {
    key: 'bookmakers',
    label: 'Bookmakers',
    list: true,
    helpText: 'Leave empty for every bookmaker your plan includes.',
    choices: { perform: venueChoices('bookmaker') },
  },
  {
    key: 'exchanges',
    label: 'Exchanges',
    list: true,
    helpText: 'Leave empty for every exchange on the board.',
    choices: { perform: venueChoices('exchange') },
  },
  {
    key: 'markets',
    label: 'Markets',
    list: true,
    dependsOn: ['feed_type'],
    helpText: 'Market keys such as h2h. Leave empty for every market on the board.',
    choices: { perform: marketChoices },
  },
];

const maxTokens = (byDefault) => ({
  key: 'max_tokens',
  label: 'Most tokens per run',
  type: 'integer',
  required: true,
  default: String(byDefault),
  helpText:
    'Each request is priced first, for free. When it would cost more than this, it is not made, nothing is ' +
    'spent and the run stops with an error. [How requests are priced](https://oddsrelay.io/docs/guides/filters-and-tokens).',
});

module.exports = {
  sportName,
  sportChoices,
  sportOnlyChoices,
  feedTypeChoices,
  venueChoices,
  marketChoices,
  eventChoices,
  feedType,
  boardFilters,
  maxTokens,
};
