'use strict';

const { FEED_TYPES, boardKey, get, eventName, latestFirst } = require('../lib/oddsrelay');
const { sportChoices, feedTypeChoices } = require('../lib/fields');

// ponytail: reads at most 4 pages (1,000 events) per check; a sport with more upcoming events needs a narrower pick.
const MAX_PAGES = 4;

const perform = async (z, bundle) => {
  const { sport, feed_type: feedType } = bundle.inputData;
  // A cursor walk can return an event twice when its kick-off moves, so events are kept by id.
  const events = new Map();
  let cursor;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await get(z, '/v2/events', { sport, cursor });
    for (const e of body.data) events.set(e.id, e);
    cursor = body.meta.next_cursor;
    if (!cursor) break;
  }
  return [...events.values()]
    .map((e) => ({ ...e, boards: (e.has_coverage || []).map(boardKey) }))
    .filter((e) => e.status === 'upcoming' && (!feedType || e.boards.includes(feedType)))
    .map((e) => ({
      id: e.id,
      name: eventName(e),
      sport_key: e.sport_key,
      sport_title: e.sport_title,
      commence_time: e.commence_time ?? null,
      home_team: e.home_team ?? null,
      away_team: e.away_team ?? null,
      feed_types: e.boards.map((t) => FEED_TYPES[t] || t).join(', '),
    }))
    .sort(latestFirst);
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
          'Pick a sport to include every competition in it, or a single competition. Each check reads the next ' +
          '1,000 events by kick-off, so for a busy sport such as soccer a competition works better.',
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
