'use strict';

// A short live run against the API with your own key: ODDSRELAY_KEY=<your key> npm test
// Skipped without the key. It makes a few free calls and three small priced ones, each capped at 25 tokens.

process.env.NODE_ENV ||= 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const zapier = require('zapier-platform-core');

const App = require('../index');
const { sportChoices } = require('../lib/fields');

const appTester = zapier.createAppTester(App);
const key = process.env.ODDSRELAY_KEY?.trim();
const live = { skip: key ? false : 'set ODDSRELAY_KEY to run the live checks' };
const authData = { apiKey: key };
const run = (op, inputData = {}) => appTester(op.operation.perform, { authData, inputData });

test('live: connect, then each trigger and search', live, async () => {
  const usage = await appTester(App.authentication.test, { authData });
  const label = await appTester(App.authentication.connectionLabel, { authData, inputData: usage });
  assert.match(label, /^key_/);
  assert.ok(!label.includes(key));

  const sports = await appTester(sportChoices, { authData, inputData: {}, meta: {} });
  assert.ok(sports.results.some((s) => s.id === 'tennis'));

  const events = await run(App.triggers.new_event, { sport: 'tennis', feed_type: 'standard' });
  assert.ok(events.length > 0, 'tennis has upcoming events');
  assert.ok(events.every((e) => e.id && e.name));
  assert.equal(new Set(events.map((e) => e.id)).size, events.length, 'ids are unique');

  const board = { feed_type: 'standard', sports: ['tennis'], bookmakers: ['william_hill'], max_tokens: 25 };
  const rows = await run(App.triggers.new_board_row, board);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'row ids are unique');
  const keys = Object.keys(App.triggers.new_board_row.operation.sample);
  for (const row of rows) assert.deepEqual(Object.keys(row), keys);

  const found = await run(App.searches.find_board, { ...board, limit: 5 });
  if (rows.length) assert.equal(found[0].row_count, rows.length);

  const [odds] = await run(App.searches.find_event_odds, { sport: 'tennis', event: events.at(-1).id, max_tokens: 25 });
  assert.equal(odds.id, events.at(-1).id);
  assert.ok(odds.price_count > 0);

  const [coverage] = await run(App.searches.find_coverage, { feed_type: 'standard', sport: 'tennis' });
  assert.ok(coverage.row_count > 0);

  const [balance] = await run(App.searches.find_token_balance);
  assert.equal(typeof balance.has_enough, 'boolean');

  console.log(
    `live: ${events.length} tennis events, ${rows.length} standard rows, ` +
      `${odds.price_count} event prices, ${coverage.row_count} coverage rows, plan ${balance.plan}`,
  );
});
