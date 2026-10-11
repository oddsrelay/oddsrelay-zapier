'use strict';

const { version } = require('./package.json');
const { version: platformVersion } = require('zapier-platform-core');
const authentication = require('./authentication');
const { addKey, check } = require('./lib/oddsrelay');

const triggers = [require('./triggers/new_event'), require('./triggers/new_board_row')];
const searches = [
  require('./searches/find_board'),
  require('./searches/find_event_odds'),
  require('./searches/find_coverage'),
  require('./searches/find_token_balance'),
];
const byKey = (list) => Object.fromEntries(list.map((op) => [op.key, op]));

module.exports = {
  version,
  platformVersion,
  authentication,
  beforeRequest: [addKey],
  afterResponse: [check],
  triggers: byKey(triggers),
  searches: byKey(searches),
  creates: {},
  // Empty fields reach perform as they are; lib/oddsrelay.js leaves them out of every request.
  flags: { cleanInputData: false },
};
