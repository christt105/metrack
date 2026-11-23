/** Whether the user wants to watch a season again. */
export const rewatchIntentBody = {
  type: 'object',
  properties: { wanted: { type: 'boolean' } },
  required: ['wanted'],
  additionalProperties: false,
} as const;
