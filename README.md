# OddsRelay for Zapier

The OddsRelay integration for Zapier: pre-match odds for UK and Irish bookmakers, with Betfair, Smarkets,
Matchbook and BETDAQ lay prices, in your Zaps. Start a Zap when a new event is listed or a new row appears on a
matched board, and look up a board, one event's prices, coverage or your token balance as a step.

API docs: https://oddsrelay.io/docs

## Connect your account

You need an OddsRelay API key. [Sign up](https://app.oddsrelay.io/signup), then copy your key from the
[Keys page](https://app.oddsrelay.io/dashboard/keys) of your dashboard. Free gives you 50,000 tokens for 14 days
from sign-up, with no card, then no tokens until you choose a plan, on the same key.

In Zapier, add an OddsRelay step and paste the key when it asks you to connect an account. Zapier checks the key
against your usage record, which costs no tokens, and names the connection after the key's id and plan.

## Triggers

| Trigger | Starts a Zap when | Tokens |
|---|---|---|
| New Event | a new upcoming event is listed in the sport or competition you choose, optionally only on one feed type | none |
| New Board Row | a new row appears on the matched board you choose: one event, market, selection and bookmaker price, beside the lowest exchange lay price, with each venue's key and name | each check is priced first and capped |

## Searches

| Search | Finds | Tokens |
|---|---|---|
| Find Board | the rows of a matched board for the feed type and filters you choose, as line items | priced first and capped |
| Find Event Odds | one event's prices at each bookmaker and exchange carrying it, as line items | priced first and capped |
| Find Coverage | which bookmakers and exchanges carry which sports on a feed type, with their event counts | none |
| Find Token Balance | the connected key's plan, tokens left and when the allowance period ends | none |

The feed types are Standard, Each-way, Extra place, Best odds guaranteed (BOG), Dutching and 2Up. Each dropdown
lists only the feed types your key can use. Find Event Odds needs a plan that includes raw odds.

## Tokens

New Board Row, Find Board and Find Event Odds spend tokens. Each of them asks the API what the request would cost
first (a quote, which is free). When the price is above the step's **Most tokens per run**, the request is not made,
nothing is spent, and the run stops with an error that says what it would have cost.

A trigger runs on every check: how often Zapier checks for new rows depends on your Zapier plan, and each check is
priced on its own. Pick a sport or competition and a few bookmakers to keep each check small: on some boards that
lowers the price, and the error says what the limit would need to be. How a request is priced:
https://oddsrelay.io/docs/guides/filters-and-tokens

Each check of New Event reads up to 1,000 events and each check of New Board Row up to 2,500 rows, latest kick-off
first, and only ids Zapier has not seen before start the Zap. When more than 100 new items arrive in one check,
Zapier's flood protection holds the runs until you confirm them; the limit is in the Zap's settings.

## Errors

| You see | What it means |
|---|---|
| Your OddsRelay API key was not accepted | The key is wrong, revoked or expired. Copy it again from the Keys page and reconnect |
| This request would cost N tokens, above your limit | The quote was above **Most tokens per run**. Raise the limit to at least N, or narrow the filters where the board's price depends on them |
| The API's message about tokens, then "Nothing was spent" | The account has too few tokens left for the request (HTTP 402) |
| OddsRelay is limiting requests from this key for a moment | Too many requests in a short time (HTTP 429). Zapier tries again after the wait the API asks for |
| A message naming a sport, bookmaker or market, with the accepted values | A filter value the API does not know |

Every error from the API carries its request id. Quote it when you contact us at https://oddsrelay.io/contact.

## Develop

Node 22 or later, and the Zapier CLI (`npm install -g zapier-platform-cli`).

```sh
npm install
npm test                                  # offline: the API contract's own example replies, no network
ODDSRELAY_KEY=your_key_here npm test      # adds a short live run: free calls and three priced calls, each capped at 25 tokens
zapier-platform validate                  # schema and Zapier's integration checks
```

The integration is written against the public OpenAPI file at https://api.oddsrelay.io/v2/openapi.json (version
2026-07-08). Every request goes to `https://api.oddsrelay.io` with the key in an `Authorization: Bearer` header;
the key is never logged, stored in this repository or shown in a connection label.

| Path | What |
|---|---|
| `index.js` | The app definition |
| `authentication.js` | The API key field, the test call and the connection label |
| `lib/oddsrelay.js` | Requests, readable errors, quote-first spending, board rows |
| `lib/fields.js` | Shared input fields and their dropdowns |
| `lib/board.js` | The board row shape shared by New Board Row and Find Board |
| `triggers/`, `searches/` | One file per trigger and search |
| `test/` | Offline tests on the contract's examples, and the live run |

## Licence

MIT. See [LICENSE](LICENSE).
