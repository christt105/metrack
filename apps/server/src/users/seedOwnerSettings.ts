import type { Logger } from '../notify/Logger.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import { OWNER_ID } from './OWNER_ID.js';
import { ownerSettingsFromEnv } from './ownerSettingsFromEnv.js';
import { SETTING_VARIABLES } from './SETTING_VARIABLES.js';
import type { UserSettings } from './UserSettings.js';

/**
 * Stores the owner's settings from the environment the first time, so the jobs keep doing what they did. From
 * then on the stored settings win, and a variable that disagrees with them is reported instead of applied.
 */
export async function seedOwnerSettings(
  settings: UserSettingsRepository,
  env: Record<string, string | undefined>,
  logger: Logger,
): Promise<void> {
  const fromEnv = ownerSettingsFromEnv(env);
  const stored = await settings.get(OWNER_ID);
  if (!stored) {
    await settings.save(OWNER_ID, fromEnv);
    logger.info(`Stored the settings of user ${OWNER_ID} from the environment`);
    return;
  }
  for (const key of Object.keys(SETTING_VARIABLES) as (keyof UserSettings)[]) {
    const value = fromEnv[key];
    if (value !== null && value !== stored[key]) {
      logger.info(
        `${SETTING_VARIABLES[key]} is ignored: user ${OWNER_ID} has ${JSON.stringify(stored[key])} stored, change it with metrack users set`,
      );
    }
  }
}
