import { FixedUserScope } from '../../src/users/FixedUserScope.js';
import { OWNER_ID } from '../../src/users/OWNER_ID.js';

/** Acts as the owner, user 1, who has everything tests store unless they say otherwise. */
export const OWNER_SCOPE = new FixedUserScope(OWNER_ID);
