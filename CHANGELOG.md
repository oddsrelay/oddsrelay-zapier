# Changelog

## 1.0.0 (unreleased)

- API key connection, tested on the usage route, labelled with the key's id and plan.
- Triggers: New Event, New Board Row.
- Searches: Find Board, Find Event Odds, Find Coverage, Find Token Balance.
- Dropdowns for feed type, sport or competition, bookmakers, exchanges, markets and events, all on free routes.
- Every step that spends tokens is priced first and capped by its "Most tokens per run" field; the error above the
  cap names the limit that would allow the request.
- New Event's feed type filter and "Feed types carrying it" read the events route's each_way, extra_place and two_up.
- Board rows carry the bookmaker's and exchanges' names beside their keys.
- Required fields come first in every step.
- Written against the OddsRelay API contract version 2026-07-08, on zapier-platform-core 19.2.0.
