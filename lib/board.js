'use strict';

// A matched board read as rows, for the New Board Row trigger and the Find Board search.

const { spend, boardRows, latestFirst } = require('./oddsrelay');

// ponytail: a check returns at most 2,500 rows, latest kick-off first; a wider board needs narrower filters.
const MAX_ROWS = 2500;

/** Reads one matched board, priced first and capped at the run's token limit, as rows. */
const readBoard = async (z, bundle) => {
  const { feed_type: feedType, sports, bookmakers, exchanges, markets, max_tokens: max } = bundle.inputData;
  const board = await spend(
    z,
    `/v2/odds/${encodeURIComponent(feedType)}`,
    { sports, bookmakers, exchanges, markets },
    Number(max),
  );
  return { board, rows: boardRows(board, feedType).sort(latestFirst) };
};

/** One row, from the API's own example of a standard board. Every row carries these keys. */
const sample = {
  id: 'or_evt_917dd44bce05|h2h|Sijia Wei||william_hill|',
  feed_type: 'standard',
  event_id: 'or_evt_917dd44bce05',
  event_name: 'Sijia Wei v Zhuoxuan Bai',
  sport_key: 'tennis_itf_w35_shenyang_chn',
  sport_title: 'ITF W35 Shenyang CHN',
  commence_time: '2026-09-17T03:00:00Z',
  home_team: 'Sijia Wei',
  away_team: 'Zhuoxuan Bai',
  venue: null,
  market: 'h2h',
  selection: 'Sijia Wei',
  line: null,
  bookmaker: 'william_hill',
  back_price: 2.9,
  back_link: 'https://sports.williamhill.com/betting/en-gb/tennis/OB_EV41212781/sijia-wei-vs-zhuoxuan-bai',
  places: null,
  place_fraction: null,
  dutch_id: null,
  lay_exchange: 'betfair_exchange',
  lay_price: 3.45,
  lay_available: 175,
  lay_link: 'https://www.betfair.com/exchange/plus/tennis/event/36078894',
  place_lay_exchange: null,
  place_lay_price: null,
  place_lay_available: null,
  place_lay_places: null,
  board_time: '2026-09-17T02:20:57.271Z',
};

/** Labels for a row's keys, for the trigger and for the search's line items. */
const rowFields = [
  ['id', 'Row ID', 'string', true],
  ['feed_type', 'Feed type', 'string', true],
  ['event_id', 'Event ID', 'string', true],
  ['event_name', 'Event', 'string', true],
  ['sport_key', 'Competition key', 'string', true],
  ['sport_title', 'Competition', 'string', true],
  ['commence_time', 'Kick-off time', 'datetime'],
  ['home_team', 'Home team', 'string'],
  ['away_team', 'Away team', 'string'],
  ['venue', 'Racecourse', 'string'],
  ['market', 'Market key', 'string', true],
  ['selection', 'Selection', 'string', true],
  ['line', 'Line (handicap or total)', 'number'],
  ['bookmaker', 'Bookmaker key', 'string', true],
  ['back_price', 'Back price (decimal)', 'number', true],
  ['back_link', 'Bookmaker event page', 'string'],
  ['places', 'Places paid', 'integer'],
  ['place_fraction', 'Place terms (fraction of the odds)', 'number'],
  ['dutch_id', 'Dutch group', 'string'],
  ['lay_exchange', 'Lay exchange key', 'string'],
  ['lay_price', 'Lay price (decimal, lowest offered)', 'number'],
  ['lay_available', 'Lay money available', 'number'],
  ['lay_link', 'Exchange market page', 'string'],
  ['place_lay_exchange', 'Place lay exchange key', 'string'],
  ['place_lay_price', 'Place lay price (decimal)', 'number'],
  ['place_lay_available', 'Place lay money available', 'number'],
  ['place_lay_places', 'Place lay places', 'integer'],
  ['board_time', 'Board time', 'datetime'],
].map(([key, label, type, required]) => ({ key, label, type, ...(required ? { required } : {}) }));

module.exports = { MAX_ROWS, readBoard, rowFields, sample };
