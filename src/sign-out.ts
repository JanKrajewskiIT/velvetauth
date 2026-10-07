import type { ResolvedAuthConfig } from './config.ts';
import { AUTH_TIMEOUT_MESSAGES } from './errors.ts';
import { withTimeout } from './timeout.ts';
import { getAuthUserManager } from './user-manager.ts';

export const requestSignOut = async (config: ResolvedAuthConfig): Promise<void> => {
  const manager = getAuthUserManager(config);
  await withTimeout(manager.signoutRedirect(), config.timeoutMs, AUTH_TIMEOUT_MESSAGES.signOut);
};
