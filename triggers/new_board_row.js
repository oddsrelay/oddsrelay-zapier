'use strict';

const { boardFilters, maxTokens } = require('../lib/fields');
const { MAX_ROWS, readBoard, rowFields, sample } = require('../lib/board');

module.exports = {
  key: 'new_board_row',
  noun: 'Board Row',
  display: {
    label: 'New Board Row',
    description:
      'Triggers when a new row (an event, market, selection and bookmaker price) appears on the matched board you choose.',
  },
  operation: {
    type: 'polling',
    inputFields: [
      ...boardFilters,
      {
        ...maxTokens(100),
        helpText:
          `${maxTokens(100).helpText} How often Zapier checks for new rows depends on your Zapier plan, and each ` +
          'check is priced and spent on its own.',
      },
    ],
    perform: async (z, bundle) => (await readBoard(z, bundle)).rows.slice(0, MAX_ROWS),
    sample,
    outputFields: rowFields,
  },
};
