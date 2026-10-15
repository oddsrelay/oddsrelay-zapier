'use strict';

const { FEED_TYPES, boardKey, get, eventName, latestFirst } = require('../lib/oddsrelay');
const { sportChoices, feedTypeChoices } = require('../lib/fields');

// ponytail: reads every page up to 40 (10,000 events; soccer, the largest sport, had 1,794 on 14 Oct 2026, at about
// 0.1 s a page) and stops with an error beyond that: a partial list lets old events in as earlier ones start.
const MAX_PAGES = 40;

const perform = async (z, bundle) => {
  const { sport, feed_type: feedType } = bundle.inputData;
  const events = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await get(z, '/v2/events', { sport, cursor });
    events.push(...body.data);
    cursor = body.meta.next_cursor;
    if (!cursor) break;
  }
  if (cursor) {
    throw new z.errors.Error(
      `This sport has more than ${(MAX_PAGES * 250).toLocaleString('en-GB')} upcoming events, too many to check ` +
        'for new ones. Pick a single competition instead.',
      'too_many_events',
      400,
    );
  }
  // One record per id: a cursor walk can return an event twice when its kick-off moves. An event's id never changes
  // for its fixture (the API's "## Versions", since 14 Oct 2026), so Zapier's duplicate check reads the id.
  const byId = new Map();
  for (const e of events) {
    const boards = (e.has_coverage || []).map(boardKey);
    if (e.status !== 'upcoming' || (feedType && !boards.includes(feedType))) continue;
    byId.set(e.id, {
      id: e.id,
      name: eventName(e),
      sport_key: e.sport_key,
      sport_title: e.sport_title,
      commence_time: e.commence_time ?? null,
      home_team: e.home_team ?? null,
      away_team: e.away_team ?? null,
      feed_types: boards.map((t) => FEED_TYPES[t] || t).join(', '),
    });
  }
  return [...byId.values()].sort(latestFirst);
};

module.exports = {
  key: 'new_event',
  noun: 'Event',
  display: {
    label: 'New Event',
    description: 'Triggers when a new upcoming event is listed in the sport or competition you choose.',
  },
  operation: {
    type: 'polling',
    inputFields: [
      {
        key: 'sport',
        label: 'Sport or competition',
        required: true,
        helpText:
          'Pick a sport to include every competition in it, or a single competition. Each check reads every ' +
          'upcoming event of your pick, up to 10,000.',
        choices: { perform: sportChoices },
      },
      {
        key: 'feed_type',
        label: 'Feed type',
        helpText: 'Only events on this matched board. Leave empty for every event.',
        choices: { perform: feedTypeChoices(false) },
      },
    ],
    perform,
    sample: {
      id: 'or_evt_46fa37cda1f2',
      name: 'James Girdler v Roger Rogowski',
      sport_key: 'tennis_australia_sydney',
      sport_title: 'Australia - Sydney',
      commence_time: '2026-09-17T02:25:00Z',
      home_team: 'James Girdler',
      away_team: 'Roger Rogowski',
      feed_types: 'Dutching',
    },
    outputFields: [
      { key: 'id', label: 'Event ID', type: 'string', required: true },
      { key: 'name', label: 'Event', type: 'string', required: true },
      { key: 'sport_key', label: 'Competition key', type: 'string', required: true },
      { key: 'sport_title', label: 'Competition', type: 'string', required: true },
      { key: 'commence_time', label: 'Kick-off time', type: 'datetime' },
      { key: 'home_team', label: 'Home team', type: 'string' },
      { key: 'away_team', label: 'Away team', type: 'string' },
      { key: 'feed_types', label: 'Feed types carrying it', type: 'string' },
    ],
  },
};
