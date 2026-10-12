'use strict';

const { KEYS_PAGE, get } = require('./lib/oddsrelay');

const PLANS = { free: 'Free', starter: 'Starter', pro: 'Pro', business: 'Max' };

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'password',
      required: true,
      helpText:
        `Copy your API key from the [Keys page](${KEYS_PAGE}) of your OddsRelay dashboard. ` +
        'No account yet? [Sign up](https://app.oddsrelay.io/signup) first.',
    },
  ],
  // The usage route answers any valid key and costs no tokens.
  test: (z) => get(z, '/v2/usage'),
  // The key's id (not the key itself) and, for the standard plans, the plan's name.
  connectionLabel: (z, bundle) => {
    const { key, plan } = bundle.inputData;
    return [key?.id, PLANS[plan] && `${PLANS[plan]} plan`].filter(Boolean).join(', ');
  },
};
