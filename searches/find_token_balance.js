'use strict';

const { FEED_TYPES, RAW, get } = require('../lib/oddsrelay');

const perform = async (z, bundle) => {
  const usage = await get(z, '/v2/usage');
  const t = usage.tokens || {};
  const unlimited = t.remaining === 'unlimited';
  const number = (v) => (typeof v === 'number' ? v : null);
  const needed = Number(bundle.inputData.tokens_needed) || 0;
  const remaining = number(t.remaining);
  const names = { ...FEED_TYPES, ...RAW, historical: 'Historical odds' };
  return [
    {
      id: usage.key?.id ?? null,
      plan: usage.plan ?? null,
      account_status: usage.account?.status ?? null,
      unlimited,
      tokens_used: number(t.used),
      tokens_remaining: remaining,
      tokens_limit: number(t.limit),
      resets_at: t.resets_at ?? null,
      has_enough: unlimited || (remaining !== null && remaining >= Math.max(needed, 1)),
      feed_types: (usage.key?.products || []).map((p) => names[p] || p).join(', '),
      regions: (usage.regions || []).join(', '),
    },
  ];
};

module.exports = {
  key: 'find_token_balance',
  noun: 'Token Balance',
  display: {
    label: 'Find Token Balance',
    description: 'Finds the plan and token balance of the connected API key.',
  },
  operation: {
    inputFields: [
      {
        key: 'tokens_needed',
        label: 'Tokens needed',
        type: 'integer',
        helpText: 'Sets "Has enough tokens" to true when at least this many are left. Leave empty to check for any.',
      },
    ],
    perform,
    sample: {
      id: 'key_XXXXXXXXXXXX',
      plan: 'free',
      account_status: 'active',
      unlimited: false,
      tokens_used: 1250,
      tokens_remaining: 48750,
      tokens_limit: 50000,
      resets_at: '2026-10-16T21:02:31Z',
      has_enough: true,
      feed_types: 'Standard, Each-way, Extra place, Best odds guaranteed (BOG), Dutching, 2Up, Raw odds, Historical odds',
      regions: 'uk',
    },
    outputFields: [
      { key: 'id', label: 'API key ID', type: 'string' },
      { key: 'plan', label: 'Plan', type: 'string' },
      { key: 'account_status', label: 'Account status', type: 'string' },
      { key: 'unlimited', label: 'Unlimited tokens', type: 'boolean', required: true },
      { key: 'tokens_used', label: 'Tokens used', type: 'integer' },
      { key: 'tokens_remaining', label: 'Tokens left', type: 'integer' },
      { key: 'tokens_limit', label: 'Token allowance', type: 'integer' },
      { key: 'resets_at', label: 'Allowance period ends', type: 'datetime' },
      { key: 'has_enough', label: 'Has enough tokens', type: 'boolean', required: true },
      { key: 'feed_types', label: 'Feed types this key can use', type: 'string' },
      { key: 'regions', label: 'Regions', type: 'string' },
    ],
  },
};
