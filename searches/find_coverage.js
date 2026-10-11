'use strict';

const { get, venues } = require('../lib/oddsrelay');
const { feedType, venueChoices, sportOnlyChoices } = require('../lib/fields');

const perform = async (z, bundle) => {
  const { feed_type: product, bookmaker, sport } = bundle.inputData;
  const coverage = await get(z, '/v2/coverage');
  const rows = [];
  for (const venue of venues(coverage.products?.[product])) {
    if (bookmaker && venue.key !== bookmaker) continue;
    for (const [key, s] of Object.entries(venue.sports || {})) {
      if (sport && key !== sport) continue;
      rows.push({ bookmaker: venue.key, bookmaker_name: venue.name, sport: key, events: s.events ?? null, last_seen: s.last_seen ?? null });
    }
  }
  if (!rows.length) return [];
  return [{ feed_type: product, region: coverage.region, generated_at: coverage.generated_at, row_count: rows.length, rows }];
};

module.exports = {
  key: 'find_coverage',
  noun: 'Coverage',
  display: {
    label: 'Find Coverage',
    description: 'Finds which bookmakers and exchanges carry which sports on a feed type, with their event counts.',
  },
  operation: {
    inputFields: [
      feedType(true),
      {
        key: 'bookmaker',
        label: 'Bookmaker or exchange',
        helpText: 'Leave empty for every venue on the feed type.',
        choices: { perform: venueChoices() },
      },
      {
        key: 'sport',
        label: 'Sport',
        helpText: 'Leave empty for every sport.',
        choices: { perform: sportOnlyChoices },
      },
    ],
    perform,
    sample: {
      feed_type: '2up',
      region: 'uk',
      generated_at: '2026-10-11T20:37:09Z',
      row_count: 1,
      rows: [{ bookmaker: '10bet', bookmaker_name: '10bet', sport: 'soccer', events: 139, last_seen: '2026-10-11T20:37:02Z' }],
    },
    outputFields: [
      { key: 'feed_type', label: 'Feed type', type: 'string', required: true },
      { key: 'region', label: 'Region', type: 'string', required: true },
      { key: 'generated_at', label: 'Coverage time', type: 'datetime' },
      { key: 'row_count', label: 'Rows found', type: 'integer', required: true },
      { key: 'rows[]bookmaker', label: 'Rows: venue key', type: 'string' },
      { key: 'rows[]bookmaker_name', label: 'Rows: venue', type: 'string' },
      { key: 'rows[]sport', label: 'Rows: sport', type: 'string' },
      { key: 'rows[]events', label: 'Rows: events carried', type: 'integer' },
      { key: 'rows[]last_seen', label: 'Rows: last seen', type: 'datetime' },
    ],
  },
};
