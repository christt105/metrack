export const nextQuery = {
  type: 'object',
  properties: { series: { type: 'integer', minimum: 1 } },
  additionalProperties: false,
} as const;
