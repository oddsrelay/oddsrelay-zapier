'use strict';

// Offline tests: every reply is one of the API contract's own examples (test/fixtures, from openapi.json
// info.version 2026-07-08). No request leaves this machine.

process.env.NODE_ENV ||= 'test'; // tells the platform this is a test run, before it loads

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const nock = require('nock');
const zapier = require('zapier-platform-core');

const App = require('../index');
const { sample: rowSample } = require('../lib/board');
const { sportChoices, marketChoices, feedTypeChoices } = require('../lib/fields');

const appTester = zapier.createAppTester(App);
const fixture = (name) => require(`./fixtures/${name}.json`);
const API = 'https://api.oddsrelay.io';
const KEY = 'test_key_not_real_0123456789';
const authData = { apiKey: KEY };

beforeEach(() => nock.disableNetConnect());
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  assert.deepEqual(pending, [], 'every mocked request was made');
});

const api = () => nock(API, { reqheaders: { authorization: `Bearer ${KEY}` } });

/** The error a perform threw, with Zapier's JSON message unpacked when there is one. */
const failure = async (promise) => {
  try {
    await promise;
  } catch (err) {
    let parsed = {};
    try {
      parsed = JSON.parse(err.message);
    } catch {
      parsed = { message: err.message };
    }
    return { name: err.name, ...parsed, raw: err.message };
  }
  assert.fail('expected an error');
};

test('the auth test reads usage with the key as a Bearer token and asks for gzip', async () => {
  nock(API, { reqheaders: { authorization: `Bearer ${KEY}`, 'accept-encoding': /gzip/ } })
    .get('/v2/usage')
    .reply(200, fixture('usage'));
  const usage = await appTester(App.authentication.test, { authData });
  assert.equal(usage.plan, 'free');
});

test('the connection label is the key id and plan, never the key', async () => {
  const label = await appTester(App.authentication.connectionLabel, { authData, inputData: fixture('usage') });
  assert.equal(label, 'key_XXXXXXXXXXXX, Free plan');
  const custom = await appTester(App.authentication.connectionLabel, {
    authData,
    inputData: { ...fixture('usage'), plan: 'ent_0000000000' },
  });
  assert.equal(custom, 'key_XXXXXXXXXXXX');
});

test('a 401 asks the user to reconnect and never repeats the key', async () => {
  api().get('/v2/usage').reply(401, fixture('error-invalid_api_key'));
  const err = await failure(appTester(App.authentication.test, { authData }));
  assert.equal(err.name, 'ExpiredAuthError');
  assert.match(err.raw, /invalid_api_key/);
  assert.match(err.raw, /dashboard\/keys/);
  assert.doesNotMatch(err.raw, new RegExp(KEY));
});

test('a 402 passes on the API message and says nothing was spent', async () => {
  api().get('/v2/usage').reply(402, fixture('error-insufficient_tokens'));
  const err = await failure(appTester(App.authentication.test, { authData }));
  assert.equal(err.code, 'insufficient_tokens');
  assert.equal(err.status, 402);
  assert.match(err.message, /costs <cost> tokens/);
  assert.match(err.message, /Nothing was spent\. \(request or_req_0+\)$/);
});

test('a 429 is a throttle with the Retry-After delay, with or without a body', async () => {
  api().get('/v2/usage').reply(429, fixture('error-too_many_requests'), { 'Retry-After': '7' });
  let err = await failure(appTester(App.authentication.test, { authData }));
  assert.equal(err.name, 'ThrottledError');
  assert.equal(err.delay, 7);
  assert.match(err.message, /too_many_requests/);

  api().get('/v2/usage').reply(429, '');
  err = await failure(appTester(App.authentication.test, { authData }));
  assert.equal(err.name, 'ThrottledError');
  assert.equal(err.delay, 60);
});

test('a 400 names the accepted values', async () => {
  api().get('/v2/events').query({ sport: 'curling_xyz' }).reply(400, fixture('error-unknown_sport'));
  const err = await failure(
    appTester(App.triggers.new_event.operation.perform, { authData, inputData: { sport: 'curling_xyz' } }),
  );
  assert.equal(err.code, 'unknown_sport');
  assert.match(err.message, /Accepted values: american_football, aussie_rules/);
});

test('New Event walks the pages, drops repeats and other boards, latest kick-off first', async () => {
  const page1 = fixture('events');
  const later = { ...page1.data[0], id: 'or_evt_later', commence_time: '2026-09-20T12:00:00Z', has_coverage: ['standard'] };
  const started = { ...page1.data[0], id: 'or_evt_started', status: 'started' };
  api().get('/v2/events').query({ sport: 'tennis' }).reply(200, page1);
  api()
    .get('/v2/events')
    .query({ sport: 'tennis', cursor: page1.meta.next_cursor })
    .reply(200, { meta: { ...page1.meta, next_cursor: null }, data: [page1.data[1], later, started] });

  const all = await appTester(App.triggers.new_event.operation.perform, { authData, inputData: { sport: 'tennis' } });
  assert.deepEqual(
    all.map((e) => e.id),
    ['or_evt_later', 'or_evt_46fa37cda1f2', 'or_evt_aa4ff8d0b3f3'],
  );
  assert.equal(all[1].name, 'James Girdler v Roger Rogowski');
  assert.equal(all[1].feed_types, 'Dutching');
  assert.deepEqual(Object.keys(all[1]).sort(), Object.keys(App.triggers.new_event.operation.sample).sort());

  api().get('/v2/events').query({ sport: 'tennis' }).reply(200, { ...page1, meta: { ...page1.meta, next_cursor: null }, data: [...page1.data, later] });
  const standard = await appTester(App.triggers.new_event.operation.perform, {
    authData,
    inputData: { sport: 'tennis', feed_type: 'standard' },
  });
  assert.deepEqual(standard.map((e) => e.id), ['or_evt_later']);
});

test('New Event reads each_way, extra_place and two_up as the feed types', async () => {
  const page = fixture('events');
  const racing = { ...page.data[0], id: 'or_evt_race', has_coverage: ['bog', 'each_way', 'extra_place'] };
  const match = { ...page.data[1], id: 'or_evt_match', has_coverage: ['standard', 'two_up'] };
  const reply = { ...page, meta: { ...page.meta, next_cursor: null }, data: [racing, match] };
  for (const [feedType, ids] of [['each-way', ['or_evt_race']], ['extra-place', ['or_evt_race']], ['2up', ['or_evt_match']]]) {
    api().get('/v2/events').query({ sport: 'tennis' }).reply(200, reply);
    const found = await appTester(App.triggers.new_event.operation.perform, {
      authData,
      inputData: { sport: 'tennis', feed_type: feedType },
    });
    assert.deepEqual(found.map((e) => e.id), ids, feedType);
  }
  api().get('/v2/events').query({ sport: 'tennis' }).reply(200, reply);
  const all = await appTester(App.triggers.new_event.operation.perform, { authData, inputData: { sport: 'tennis' } });
  assert.deepEqual(all.map((e) => e.feed_types).sort(), [
    'Best odds guaranteed (BOG), Each-way, Extra place',
    'Standard, 2Up',
  ]);
});

test('New Event lists a fixture once, under a key that outlives its id; the duplicate check reads that key', async () => {
  const page = fixture('events');
  const darts = (id, home, away, commence_time) => ({ ...page.data[0], id, home_team: home, away_team: away, commence_time });
  const data = [
    // One fixture, three events: two spellings at once, then a new id and kick-off when an exchange lists it.
    darts('or_evt_b2dcc17cca36', 'Jim McEwan', 'Josh McCarthy', '2026-10-15T12:55:00Z'),
    darts('or_evt_8130dbbf3605', 'McEwan, Jim', 'McCarthy, Josh', '2026-10-15T13:05:00Z'),
    darts('or_evt_d064e5173897', 'Jim Mcewan', 'Josh Mccarthy', '2026-10-15T13:05:00Z'),
    // The same pair on another day is another fixture.
    darts('or_evt_rematch', 'Jim McEwan', 'Josh McCarthy', '2026-10-22T12:55:00Z'),
    // Pairs, accents and initials: one fixture.
    darts('or_evt_pair1', 'S. Kopp/Y. Milev', 'I. Almazán Valiente/P. Lagutin', '2026-10-15T14:00:00Z'),
    darts('or_evt_pair2', 'Kopp, Sandro/Milev, Yanaki', 'Almazan Valiente, Izan/Lagutin, Pavel', '2026-10-15T14:15:00Z'),
    // No sides (racing), or sides that reduce to one name: each keeps its id.
    darts('or_evt_race1', null, null, '2026-10-15T12:02:00Z'),
    darts('or_evt_race2', null, null, '2026-10-15T12:25:00Z'),
    darts('or_evt_res1', 'Real Pilar FC (Reserves)', 'CA Villa San Carlos Reserves', '2026-10-15T14:00:00Z'),
    darts('or_evt_res2', 'CA Boca Juniors (Reserves)', 'Ferro Reserves', '2026-10-15T22:00:00Z'),
  ];
  api().get('/v2/events').query({ sport: 'darts' }).reply(200, { ...page, meta: { ...page.meta, next_cursor: null }, data });
  const found = await appTester(App.triggers.new_event.operation.perform, { authData, inputData: { sport: 'darts' } });
  assert.deepEqual(
    found.map((e) => e.fixture_key),
    [
      'mcewan|mccarthy|2026-10-22',
      'or_evt_res2',
      'kopp+milev|lagutin+valiente|2026-10-15',
      'or_evt_res1',
      'mcewan|mccarthy|2026-10-15',
      'or_evt_race2',
      'or_evt_race1',
    ],
  );

  const primary = App.triggers.new_event.operation.outputFields.filter((f) => f.primary).map((f) => f.key);
  assert.deepEqual(primary, ['fixture_key']);
});

test('New Event reads every page, and stops with an error past 10,000 events', async () => {
  const page = fixture('events');
  const reply = (i, next) => ({
    meta: { ...page.meta, next_cursor: next },
    data: [{ ...page.data[0], id: `or_evt_${i}`, commence_time: `2026-10-${10 + i}T12:00:00Z` }],
  });
  for (let i = 0; i < 6; i++) {
    api().get('/v2/events').query({ sport: 'tennis', ...(i ? { cursor: `c${i}` } : {}) }).reply(200, reply(i, i < 5 ? `c${i + 1}` : null));
  }
  const six = await appTester(App.triggers.new_event.operation.perform, { authData, inputData: { sport: 'tennis' } });
  assert.deepEqual(six.map((e) => e.id), ['or_evt_5', 'or_evt_4', 'or_evt_3', 'or_evt_2', 'or_evt_1', 'or_evt_0']);

  for (let i = 0; i < 40; i++) {
    api().get('/v2/events').query({ sport: 'soccer', ...(i ? { cursor: `c${i}` } : {}) }).reply(200, reply(0, `c${i + 1}`));
  }
  const err = await failure(appTester(App.triggers.new_event.operation.perform, { authData, inputData: { sport: 'soccer' } }));
  assert.equal(err.code, 'too_many_events');
  assert.match(err.message, /more than 10,000 upcoming events/);
});

const boardInput = { feed_type: 'standard', sports: ['tennis'], bookmakers: ['william_hill'], exchanges: [], max_tokens: 100 };
// The venues fixture, plus the venues the board fixtures name (kwiff is left out: an unknown key stands in as its name).
const venues = () => {
  const body = fixture('bookmakers');
  const extra = [
    { key: 'william_hill', name: 'William Hill', regions: ['uk'], is_exchange: false },
    { key: 'betfair_exchange', name: 'Betfair Exchange', regions: ['uk'], is_exchange: true },
  ];
  return { ...body, data: [...body.data, ...extra] };
};

test('New Board Row prices the board first, then turns it into one row per bookmaker price', async () => {
  api()
    .get('/v2/odds/standard')
    .query({ sports: 'tennis', bookmakers: 'william_hill', quote: 'true' })
    .reply(200, { ...fixture('quote'), cost: 12 });
  api().get('/v2/odds/standard').query({ sports: 'tennis', bookmakers: 'william_hill' }).reply(200, fixture('odds-standard'));
  api().get('/v2/bookmakers').reply(200, venues());

  const rows = await appTester(App.triggers.new_board_row.operation.perform, { authData, inputData: boardInput });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], rowSample);
});

test('New Board Row stops before spending when the quote is above the limit', async () => {
  api()
    .get('/v2/odds/standard')
    .query({ sports: 'tennis', bookmakers: 'william_hill', quote: 'true' })
    .reply(200, { ...fixture('quote'), cost: 540 });
  const err = await failure(
    appTester(App.triggers.new_board_row.operation.perform, { authData, inputData: boardInput }),
  );
  assert.equal(err.code, 'over_token_limit');
  assert.match(err.message, /cost 540 tokens, above your limit of 100/);
  assert.match(err.message, /"Most tokens per run" to at least 540/);
});

test('each-way rows carry the place terms and both lays; dutching rows carry the dutch group', async () => {
  for (const [type, file] of [['each-way', 'odds-each-way'], ['dutching', 'odds-dutching']]) {
    api().get(`/v2/odds/${type}`).query({ quote: 'true' }).reply(200, fixture('quote'));
    api().get(`/v2/odds/${type}`).reply(200, fixture(file));
    api().get('/v2/bookmakers').reply(200, venues());
  }
  const ew = await appTester(App.triggers.new_board_row.operation.perform, {
    authData,
    inputData: { feed_type: 'each-way', max_tokens: 10 },
  });
  assert.equal(ew[0].event_name, 'Illawarra Grange');
  assert.equal(ew[0].places, 3);
  assert.equal(ew[0].place_fraction, 0.2);
  assert.equal(ew[0].lay_price, 3.25);
  assert.equal(ew[0].place_lay_price, 2.16);
  assert.equal(ew[0].place_lay_places, 3);
  assert.equal(ew[0].bookmaker_name, 'kwiff', 'a venue missing from the list keeps its key as its name');
  assert.equal(ew[0].lay_exchange_name, 'Betfair Exchange');

  const dutch = await appTester(App.triggers.new_board_row.operation.perform, {
    authData,
    inputData: { feed_type: 'dutching', max_tokens: 10 },
  });
  assert.equal(dutch.length, 2);
  assert.ok(dutch.every((r) => r.dutch_id === 'b8d7916c' && r.lay_price === null));
  assert.notEqual(dutch[0].id, dutch[1].id);

  // Every row has exactly the sample's keys, whatever the feed type: Zapier needs the sample to match live rows.
  for (const row of [...ew, ...dutch]) assert.deepEqual(Object.keys(row), Object.keys(rowSample));
});

test('Find Board returns the board as line items, cut to the row limit', async () => {
  api().get('/v2/odds/each-way').query({ quote: 'true' }).reply(200, fixture('quote'));
  api().get('/v2/odds/each-way').reply(200, fixture('odds-each-way'));
  api().get('/v2/bookmakers').reply(200, venues());
  const [board] = await appTester(App.searches.find_board.operation.perform, {
    authData,
    inputData: { feed_type: 'each-way', max_tokens: 10, limit: 1 },
  });
  assert.equal(board.rows.length, 1);
  assert.equal(board.rows_not_shown, board.row_count - 1);
  assert.equal(board.board_time, '2026-09-17T02:20:28.456Z');

  api().get('/v2/odds/bog').query({ quote: 'true' }).reply(200, fixture('quote'));
  api().get('/v2/odds/bog').reply(200, { meta: fixture('odds-standard').meta, data: [] });
  api().get('/v2/bookmakers').reply(200, venues());
  const none = await appTester(App.searches.find_board.operation.perform, {
    authData,
    inputData: { feed_type: 'bog', max_tokens: 10 },
  });
  assert.deepEqual(none, []);
});

test('Find Event Odds narrows to the chosen venues and markets, and a missing event is no result', async () => {
  const path = '/v2/odds/event/or_evt_da71d5873e85';
  api().get(path).query({ quote: 'true' }).reply(200, fixture('quote'));
  api().get(path).reply(200, fixture('event'));
  const [event] = await appTester(App.searches.find_event_odds.operation.perform, {
    authData,
    inputData: { sport: 'tennis', event: 'or_evt_da71d5873e85', bookmakers: 'bet600', markets: ['h2h'], max_tokens: 25 },
  });
  assert.equal(event.name, 'Natsuki Yoshimoto v Tiana Tian Deng');
  assert.equal(event.bookmaker_count, 1);
  assert.deepEqual(event.prices.map((p) => [p.bookmaker, p.market, p.selection, p.back_price]), [
    ['bet600', 'h2h', 'Natsuki Yoshimoto', 1.7],
    ['bet600', 'h2h', 'Tiana Tian Deng', 2],
  ]);
  assert.deepEqual(Object.keys(event).sort(), Object.keys(App.searches.find_event_odds.operation.sample).sort());

  api().get('/v2/odds/event/or_evt_gone').query({ quote: 'true' }).reply(404, {
    error: { code: 'not_found', message: 'No such event.', request_id: 'or_req_0' },
  });
  const none = await appTester(App.searches.find_event_odds.operation.perform, {
    authData,
    inputData: { sport: 'tennis', event: 'or_evt_gone', max_tokens: 25 },
  });
  assert.deepEqual(none, []);
});

test('Find Event Odds explains a key without raw odds', async () => {
  api().get('/v2/odds/event/or_evt_x').query({ quote: 'true' }).reply(403, fixture('error-not_in_key_scope'));
  const err = await failure(
    appTester(App.searches.find_event_odds.operation.perform, {
      authData,
      inputData: { sport: 'tennis', event: 'or_evt_x', max_tokens: 25 },
    }),
  );
  assert.equal(err.code, 'not_in_key_scope');
  assert.match(err.message, /does not include 'raw'/);
});

test('Find Coverage lists bookmakers and exchanges, filtered, and nothing found is no result', async () => {
  api().get('/v2/coverage').reply(200, fixture('coverage-keyed'));
  const [all] = await appTester(App.searches.find_coverage.operation.perform, {
    authData,
    inputData: { feed_type: '2up' },
  });
  assert.deepEqual(all.rows.map((r) => r.bookmaker), ['betmgm', 'betdaq']);
  assert.equal(all.rows[1].events, 149);

  api().get('/v2/coverage').reply(200, fixture('coverage-keyed'));
  const none = await appTester(App.searches.find_coverage.operation.perform, {
    authData,
    inputData: { feed_type: '2up', sport: 'tennis' },
  });
  assert.deepEqual(none, []);
});

test('Find Token Balance reads unlimited and counted balances', async () => {
  api().get('/v2/usage').reply(200, fixture('usage'));
  const [unlimited] = await appTester(App.searches.find_token_balance.operation.perform, { authData, inputData: {} });
  assert.equal(unlimited.unlimited, true);
  assert.equal(unlimited.tokens_remaining, null);
  assert.equal(unlimited.has_enough, true);
  assert.deepEqual(Object.keys(unlimited).sort(), Object.keys(App.searches.find_token_balance.operation.sample).sort());

  const counted = { ...fixture('usage'), tokens: { used: 49000, remaining: 1000, limit: 50000, resets_at: null } };
  api().get('/v2/usage').reply(200, counted);
  const [low] = await appTester(App.searches.find_token_balance.operation.perform, {
    authData,
    inputData: { tokens_needed: 5000 },
  });
  assert.equal(low.tokens_remaining, 1000);
  assert.equal(low.has_enough, false);
});

test('the sport dropdown lists each sport, then competitions a page at a time', async () => {
  const sports = fixture('sports');
  api().get('/v2/coverage').reply(200, fixture('coverage-keyed'));
  api().get('/v2/sports').reply(200, sports);
  const first = await appTester(sportChoices, { authData, inputData: {}, meta: {} });
  assert.equal(first.paging_token, sports.meta.next_cursor);
  assert.deepEqual(first.results[0], { id: 'american_football', label: 'American Football (every competition)' });
  assert.ok(first.results.some((r) => r.id === sports.data[0].key));

  api().get('/v2/sports').query({ cursor: 'abc' }).reply(200, { ...sports, meta: { ...sports.meta, next_cursor: null } });
  const next = await appTester(sportChoices, { authData, inputData: {}, meta: { paging_token: 'abc' } });
  assert.equal(next.paging_token, null);
  assert.equal(next.results.length, sports.data.length);
});

test('the market dropdown reads coverage without the key; the feed type dropdown follows the key', async () => {
  nock(API, { badheaders: ['authorization'] }).get('/v2/coverage').reply(200, fixture('coverage-keyless'));
  const markets = await appTester(marketChoices, { authData, inputData: { feed_type: '2up' }, meta: {} });
  assert.deepEqual(markets.results, fixture('coverage-keyless').markets['2up'].map((id) => ({ id, label: id })));

  api().get('/v2/usage').reply(200, { ...fixture('usage'), key: { ...fixture('usage').key, products: ['2up', 'raw'] } });
  const types = await appTester(feedTypeChoices(false), { authData, inputData: {}, meta: {} });
  assert.deepEqual(types.results, [{ id: '2up', label: '2Up' }]);
});
