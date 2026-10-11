'use strict';

const { spend, eventName, list } = require('../lib/oddsrelay');
const { sportChoices, eventChoices, venueChoices, marketChoices, maxTokens } = require('../lib/fields');

// ponytail: at most 1,000 prices per event in one result; the rest are counted. Pick bookmakers or markets to narrow.
const MAX_PRICES = 1000;

const perform = async (z, bundle) => {
  const { event: id, max_tokens: max } = bundle.inputData;
  const [bookmakers, markets] = [list(bundle.inputData.bookmakers), list(bundle.inputData.markets)];
  let event;
  try {
    event = await spend(z, `/v2/odds/event/${encodeURIComponent(id)}`, {}, Number(max));
  } catch (err) {
    if (err.httpStatus === 404) return []; // the event is not on the feed (any more)
    throw err;
  }
  // The route takes no bookmaker or market filter: the result is narrowed here, which does not change the price.
  const prices = [];
  const books = event.bookmakers.filter((b) => !bookmakers.length || bookmakers.includes(b.key));
  for (const book of books) {
    for (const market of book.markets.filter((m) => !markets.length || markets.includes(m.key))) {
      for (const o of market.outcomes) {
        prices.push({
          bookmaker: book.key,
          bookmaker_name: book.title,
          market: market.key,
          selection: o.name,
          back_price: o.price ?? o.back_price ?? null,
          lay_price: o.lay_price ?? null,
          lay_available: o.available ?? null,
          last_update: market.last_update ?? null,
        });
      }
    }
  }
  return [
    {
      id: event.id,
      name: eventName(event),
      sport_key: event.sport_key,
      sport_title: event.sport_title,
      commence_time: event.commence_time ?? null,
      home_team: event.home_team ?? null,
      away_team: event.away_team ?? null,
      bookmaker_count: books.length,
      price_count: prices.length,
      prices_not_shown: Math.max(prices.length - MAX_PRICES, 0),
      prices: prices.slice(0, MAX_PRICES),
    },
  ];
};

const price = {
  bookmaker: 'bet600',
  bookmaker_name: 'Bet600',
  market: 'h2h',
  selection: 'Natsuki Yoshimoto',
  back_price: 1.7,
  lay_price: null,
  lay_available: null,
  last_update: '2026-09-17T02:17:02Z',
};

module.exports = {
  key: 'find_event_odds',
  noun: 'Event Odds',
  display: {
    label: 'Find Event Odds',
    description: 'Finds the prices for one event at each bookmaker and exchange that carries it.',
  },
  operation: {
    inputFields: [
      {
        key: 'sport',
        label: 'Sport or competition',
        required: true,
        altersDynamicFields: true,
        helpText: 'Lists the events below. When you map an event from an earlier step, map its competition key here.',
        choices: { perform: sportChoices },
      },
      {
        key: 'event',
        label: 'Event',
        required: true,
        dependsOn: ['sport'],
        helpText: 'Needs an API key whose plan includes raw odds.',
        choices: { perform: eventChoices },
      },
      {
        key: 'bookmakers',
        label: 'Bookmakers and exchanges',
        list: true,
        helpText: 'Leave empty for every venue carrying the event.',
        choices: { perform: venueChoices() },
      },
      {
        key: 'markets',
        label: 'Markets',
        list: true,
        helpText: 'Market keys such as h2h. Leave empty for every market.',
        choices: { perform: marketChoices },
      },
      maxTokens(25),
    ],
    perform,
    sample: {
      id: 'or_evt_da71d5873e85',
      name: 'Natsuki Yoshimoto v Tiana Tian Deng',
      sport_key: 'tennis_itf_women_kyoto_2026',
      sport_title: 'ITF Women Kyoto 2026',
      commence_time: '2026-09-17T02:24:00Z',
      home_team: 'Natsuki Yoshimoto',
      away_team: 'Tiana Tian Deng',
      bookmaker_count: 1,
      price_count: 1,
      prices_not_shown: 0,
      prices: [price],
    },
    outputFields: [
      { key: 'id', label: 'Event ID', type: 'string', required: true },
      { key: 'name', label: 'Event', type: 'string', required: true },
      { key: 'sport_key', label: 'Competition key', type: 'string', required: true },
      { key: 'sport_title', label: 'Competition', type: 'string', required: true },
      { key: 'commence_time', label: 'Kick-off time', type: 'datetime' },
      { key: 'home_team', label: 'Home team', type: 'string' },
      { key: 'away_team', label: 'Away team', type: 'string' },
      { key: 'bookmaker_count', label: 'Venues shown', type: 'integer', required: true },
      { key: 'price_count', label: 'Prices found', type: 'integer', required: true },
      { key: 'prices_not_shown', label: 'Prices not shown', type: 'integer', required: true },
      { key: 'prices[]bookmaker', label: 'Prices: venue key', type: 'string' },
      { key: 'prices[]bookmaker_name', label: 'Prices: venue', type: 'string' },
      { key: 'prices[]market', label: 'Prices: market key', type: 'string' },
      { key: 'prices[]selection', label: 'Prices: selection', type: 'string' },
      { key: 'prices[]back_price', label: 'Prices: back price (decimal)', type: 'number' },
      { key: 'prices[]lay_price', label: 'Prices: lay price (decimal)', type: 'number' },
      { key: 'prices[]lay_available', label: 'Prices: lay money available', type: 'number' },
      { key: 'prices[]last_update', label: 'Prices: market last changed', type: 'datetime' },
    ],
  },
};
