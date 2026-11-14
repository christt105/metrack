import { ALERT_KINDS, ALERT_SUBJECT_TYPES } from '@metrack/domain';

export const recordAlertsBody = {
  type: 'object',
  properties: {
    alerts: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        properties: {
          subjectType: { enum: [...ALERT_SUBJECT_TYPES] },
          subjectId: { type: 'integer', minimum: 1 },
          kind: { enum: [...ALERT_KINDS] },
          title: { type: 'string', maxLength: 1000 },
          message: { type: 'string', maxLength: 1000 },
          sentAt: { type: 'string', minLength: 1, maxLength: 40 },
        },
        required: ['subjectType', 'subjectId', 'kind', 'title', 'message', 'sentAt'],
      },
    },
  },
  required: ['alerts'],
} as const;
