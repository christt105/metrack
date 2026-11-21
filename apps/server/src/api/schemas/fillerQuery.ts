export const fillerQuery = {
  type: 'object',
  properties: { slug: { type: 'string', maxLength: 200 } },
  additionalProperties: false,
} as const;
