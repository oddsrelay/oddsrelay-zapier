'use strict';

const { boardFilters, maxTokens } = require('../lib/fields');
const { readBoard, rowFields, sample } = require('../lib/board');

const perform = async (z, bundle) => {
  const { board, rows } = await readBoard(z, bundle);
  if (!rows.length) return [];
  const limit = Math.min(Math.max(Number(bundle.inputData.limit) || 100, 1), 1000);
  return [
    {
      feed_type: bundle.inputData.feed_type,
      board_time: board.meta?.processed_at ?? null,
      row_count: rows.length,
      rows_not_shown: Math.max(rows.length - limit, 0),
      rows: rows.slice(0, limit),
    },
  ];
};

module.exports = {
  key: 'find_board',
  noun: 'Board',
  display: {
    label: 'Find Board',
    description: 'Finds the rows of a matched board for the feed type and filters you choose.',
  },
  operation: {
    inputFields: [
      ...boardFilters,
      maxTokens(100),
      {
        key: 'limit',
        label: 'Most rows',
        type: 'integer',
        default: '100',
        helpText: 'Up to 1000. Rows come latest kick-off first; the rest are counted in "Rows not shown".',
      },
    ],
    perform,
    sample: { feed_type: 'standard', board_time: sample.board_time, row_count: 1, rows_not_shown: 0, rows: [sample] },
    outputFields: [
      { key: 'feed_type', label: 'Feed type', type: 'string', required: true },
      { key: 'board_time', label: 'Board time', type: 'datetime' },
      { key: 'row_count', label: 'Rows on the board', type: 'integer', required: true },
      { key: 'rows_not_shown', label: 'Rows not shown', type: 'integer', required: true },
      ...rowFields.map(({ key, label, type }) => ({ key: `rows[]${key}`, label: `Rows: ${label}`, type })),
    ],
  },
};
