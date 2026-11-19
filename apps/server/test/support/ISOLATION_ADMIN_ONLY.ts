/** Owner-only routes without ids, with what a request needs to pass validation; user 2 must be refused with 403. */
export const ISOLATION_ADMIN_ONLY: Readonly<Record<string, unknown>> = {
  'GET /api/users': undefined,
  'GET /api/users/summary': undefined,
  'GET /api/invites': undefined,
  'POST /api/invites': { maxUses: 1 },
  'GET /api/backups': undefined,
  'POST /api/backups': undefined,
  'POST /api/images/cleanup': undefined,
};
