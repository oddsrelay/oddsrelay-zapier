# Zapier submission texts

Everything the Zapier Platform asks for when this integration is registered and submitted for the App Directory.
Re-read the publishing requirements on the day you submit: forms change.

## Integration settings

`zapier-platform register` asks for these, and the Platform UI keeps them under the integration's settings.

| Field | Value |
|---|---|
| Title | OddsRelay |
| Description | OddsRelay is a pre-match odds API for UK and Irish bookmakers, with exchange lay prices beside bookmaker back prices. |
| Homepage URL | https://oddsrelay.io |
| Category | Developer Tools (`developer-tools`) |
| Intended audience | Public (`global`) |
| Your role | Employee (`employee`) |
| Logo | `logo.png` in this folder: 512 x 512 PNG, RGBA, transparent background, the mark without the wordmark |

The description is 117 characters, starts "OddsRelay is a", names no other app and says nothing about syncing (Zapier's
check M002 wants 40 to 140 characters in that form). The logo meets check M004 (square PNG, at least 256 x 256,
RGBA with transparency).

## Longer description

For any field that asks for more than the one line:

> OddsRelay is a pre-match odds API for UK and Irish bookmakers. It serves six feed types of matched odds
> (Standard, Each-way, Extra place, Best odds guaranteed, Dutching and 2Up), which put each bookmaker back price
> beside exchange lay prices, and every price for a single event. With this integration you can start a Zap when a
> new event is listed or a new row appears on a board, and look up a board, one event's prices, coverage or your
> token balance as a step: log fixtures to a sheet, feed board rows into your own tools, or tell your team when a
> bookmaker prices a new selection.

## Publishing request notes

> OddsRelay is an odds data API for businesses and developers. Requests are paid for in tokens from the account's
> allowance, so every step that spends tokens (New Board Row, Find Board, Find Event Odds) first asks the API for a
> free price quote and stops with an error, without spending, when the quote is above the step's "Most tokens per
> run" field. New Event, Find Coverage, Find Token Balance, the connection test and every dropdown use free routes.
>
> Both triggers are polling triggers. New Event uses the event id as its primary key. New Board Row uses a row id
> built from the event, market, selection, line, bookmaker and dutch group, so a row triggers once however often
> its price changes. Find Board and Find Event Odds return one record with the rows or prices as line items, for
> steps such as "Create Multiple Spreadsheet Rows". A search that finds nothing returns no result rather than an
> error.
>
> The API lists events by kick-off, not by when they were added, and new fixtures usually appear at the far end of
> the schedule. Both triggers therefore sort latest kick-off first and return more than the usual 100 items (New
> Event up to 1,000 events, New Board Row up to 2,500 rows) so that a new item further down is not missed;
> deduplication then triggers only on ids it has not seen. Each board row carries the venue keys and their display
> names.
>
> Find Event Odds needs an API key whose plan includes raw odds; the test account's key has every feed type and
> unlimited tokens.
>
> API documentation: https://oddsrelay.io/docs. OpenAPI file: https://api.oddsrelay.io/v2/openapi.json.

## Test account

Zapier asks for a non-expiring account on integration-testing@zapier.com with every feature the integration uses
(publishing requirements section 7.1). Notes for the form:

> Account email: integration-testing@zapier.com. Sign-in at https://app.oddsrelay.io/login is passwordless: a
> one-time code is sent to that address, so there is no password to reset. The account has every feed type,
> including raw odds, and unlimited tokens with no end date. Its API key is on the Keys page
> (https://app.oddsrelay.io/dashboard/keys); a key for it is also in the private notes below.

## Before you submit

These checks can only be passed from the Zapier account that owns the integration.

| Check | What it needs |
|---|---|
| M005, requirement 7.2 | The account that owns the integration, or one admin on its team, signs in with an @oddsrelay.io address (the homepage's domain) |
| M003 | "Your role" is Employee |
| U001 | Zapier's latest Developer Terms are accepted in the Platform UI |
| Requirement 7.1 | The test account above exists and its key works |
| A001, S001, S002, T001 | A connected OddsRelay account; the six Zaps below turned on, each with at least one successful run (never delete them or their runs); and at least 3 users with a live Zap (you and two others invited to the private integration) |

## Zaps to run before submitting

Zapier wants every visible trigger and search in a live Zap with a successful run (checks S002 and T001), and at
least 3 users with live Zaps. These six cover all of them and double as Zap template ideas for the beta period.

| # | Trigger | Steps |
|---|---|---|
| 1 | OddsRelay: New Event (Tennis, every competition) | Google Sheets: Create Spreadsheet Row |
| 2 | OddsRelay: New Board Row (Standard, Tennis, William Hill, Most tokens per run 25) | Google Sheets: Create Spreadsheet Row |
| 3 | Schedule by Zapier: every day at 08:00 | OddsRelay: Find Board (Each-way, Most tokens per run 300, Horse Racing, Most rows 50), then Google Sheets: Create Multiple Spreadsheet Rows from the rows |
| 4 | OddsRelay: New Event (Darts, Standard) | OddsRelay: Find Event Odds (map Competition key and Event ID), then Google Sheets: Create Spreadsheet Row |
| 5 | Schedule by Zapier: every day | OddsRelay: Find Coverage (2Up, Soccer), then Email by Zapier |
| 6 | Schedule by Zapier: every Monday | OddsRelay: Find Token Balance (Tokens needed 1000), Filter by Zapier (Has enough tokens is false), Email by Zapier |

## Checks run before handing over (11 Oct 2026)

- `zapier-platform validate` (zapier-platform-cli 19.2.0): structurally sound; 28 integration checks passed, none
  failed, no warnings.
- `zapier-platform build`: build.zip built and its own test passed.
- `npm test`: 18 offline tests on the API contract's example replies pass; the live run passes with a real key.
- A second, independent check from a fresh clone and a clean install: the same results, plus a live run of every
  trigger, search and dropdown, including each matched board through New Board Row and each feed type through New
  Event's filter. Every live row matched its output fields and the sample's keys, and every id was unique.

## Sources (read 11 Oct 2026)

- https://docs.zapier.com/integrations/publish/integration-publishing-requirements
- https://docs.zapier.com/integrations/publish/integration-build-guidelines
- https://docs.zapier.com/platform/publish/integration-checks-reference
- https://docs.zapier.com/integrations/publish/public-integration.md
- https://docs.zapier.com/platform/build/test-monitoring
- https://docs.zapier.com/platform/build/deduplication
- https://docs.zapier.com/platform/build-cli/overview
- https://docs.zapier.com/platform/build-cli/input-fields
- https://docs.zapier.com/platform/build-cli/dynamic-dropdowns
- https://www.npmjs.com/package/zapier-platform-core (19.2.0, published 7 Oct 2026)
