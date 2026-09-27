import { getConfigIdentity, getTimeoutMs } from './config';
import { clearPersistedUserAfterRemoteSignOut, getSignOutGeneration, subscribeToSignOut } from './cross-tab';
import { beginManagedRenewal } from './renewal-state';
import { isBrowserRuntime, withTimeout } from './runtime';
import type { OidcAuthConfig } from './types';
import { getAuthUserManager } from './user-manager';

export const getAuthAccessToken = async (config: OidcAuthConfig): Promise<string | undefined> => {
  if (!isBrowserRuntime()) return undefined;

  const generation = getSignOutGeneration(config.authority, config.clientId);
  const unsubscribe = subscribeToSignOut(config.authority, config.clientId, () => {
    clearPersistedUserAfterRemoteSignOut(config.authority, config.clientId);
  });

  try {
    if (generation !== getSignOutGeneration(config.authority, config.clientId)) return undefined;
    const manager = getAuthUserManager(config);
    const user = await withTimeout(manager.getUser(), getTimeoutMs(config), 'Access-token user lookup timed out.');
    if (generation !== getSignOutGeneration(config.authority, config.clientId)) return undefined;
    if (!user) return undefined;
    if (!user.expired) return user.access_token || undefined;

    try {
      const finishExternalRenewal = beginManagedRenewal(getConfigIdentity(config));
      let renewal: ReturnType<typeof manager.signinSilent>;
      try {
        renewal = manager.signinSilent();
      } catch (error: unknown) {
        finishExternalRenewal();
        throw error;
      }
      renewal.then(finishExternalRenewal, finishExternalRenewal);
      const renewedUser = await withTimeout(renewal, getTimeoutMs(config), 'Silent renewal timed out.');
      if (generation !== getSignOutGeneration(config.authority, config.clientId)) return undefined;
      return renewedUser?.access_token || undefined;
    } catch {
      return undefined;
    }
  } finally {
    unsubscribe();
  }
};
