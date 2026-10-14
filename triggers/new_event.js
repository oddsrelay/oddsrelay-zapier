'use strict';

const { FEED_TYPES, boardKey, get, eventName, latestFirst } = require('../lib/oddsrelay');
const { sportChoices, feedTypeChoices } = require('../lib/fields');

// ponytail: reads every page up to 40 (10,000 events; soccer, the largest sport, had 1,794 on 14 Oct 2026, at about
// 0.1 s a page) and stops with an error beyond that: a partial list lets old events in as earlier ones start.
const MAX_PAGES = 40;

/** A side's main name, one per player of a pair: the surname of "Surname, First", else the longest word. */
const mainName = (side) =>
  side
    .split('/')
    .map((player) => {
      const words = player.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(',')[0];
      return (words.match(/[a-z]+/g) || []).reduce((a, b) => (b.length > a.length ? b : a), '');
    })
    .sort()
    .join('+');

/**
 * What Zapier's duplicate check compares, in place of the event id. The API can list one fixture as two or three
 * events at once ("McEwan, Jim" beside "Jim McEwan"), and gives an event a new id, competition key and kick-off
 * when an exchange lists it, so on 14 Oct 2026 nine in ten new tennis ids were a fixture already listed. The key is
 * each side's main name and the kick-off day. Racing events have no sides and keep their id, as does a fixture whose
 * two sides reduce to the same name ("X Reserves v Y Reserves").
 */
// ponytail: spellings that differ in their main name ("Christasha McNeil" / "Mcneil, C"), or a move to another day,
// still trigger twice; two fixtures with the same main names on one day (a club's men and women) would trigger once,
// which 14 Oct 2026's data never showed. The real fix is an event id the API never changes.
const fixtureKey = (e) => {
  const home = e.home_team && mainName(e.home_team);
  const away = e.away_team && mainName(e.away_team);
  return home && away && home !== away ? `${home}|${away}|${String(e.commence_time).slice(0, 10)}` : e.id;
};

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
  // One record per fixture: a cursor walk can return an event twice, and the API can list a fixture more than once.
  const fixtures = new Map();
  for (const e of events) {
    const boards = (e.has_coverage || []).map(boardKey);
    if (e.status !== 'upcoming' || (feedType && !boards.includes(feedType))) continue;
    fixtures.set(fixtureKey(e), {
      id: e.id,
      fixture_key: fixtureKey(e),
      name: eventName(e),
      sport_key: e.sport_key,
      sport_title: e.sport_title,
      commence_time: e.commence_time ?? null,
      home_team: e.home_team ?? null,
      away_team: e.away_team ?? null,
      feed_types: boards.map((t) => FEED_TYPES[t] || t).join(', '),
    });
  }
  return [...fixtures.values()].sort(latestFirst);
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
      fixture_key: 'girdler|rogowski|2026-09-17',
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
      // The duplicate check reads this, not the event id, which can change before kick-off.
      { key: 'fixture_key', label: 'Fixture key (sides and kick-off day)', type: 'string', required: true, primary: true },
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
