import type { User } from 'oidc-client-ts';

import type { OidcAuthConfig, ResolvedAuthConfig } from './config.ts';
import { resolveAuthConfig } from './config.ts';
import { AUTH_TIMEOUT_MESSAGES } from './errors.ts';
import { runExternalOperation } from './external-operations.ts';
import { getAccessToken } from './identity.ts';
import { isBrowserRuntime } from './runtime.ts';
import { getSignOutChannel } from './sign-out-channel.ts';
import { withTimeout } from './timeout.ts';
import type { AuthUserManager } from './user-manager.ts';
import { getAuthUserManager } from './user-manager.ts';

const renewAccessToken = async (manager: AuthUserManager, config: ResolvedAuthConfig): Promise<User | null> => {
  try {
    return await withTimeout(
      runExternalOperation(manager, () => manager.signinSilent()),
      config.timeoutMs,
      AUTH_TIMEOUT_MESSAGES.silentRenewal,
    );
  } catch {
    // The getter's contract is "a token or no token"; renewal failure is one of the no-token causes.
    return null;
  }
};

export const getAuthAccessToken = async (config: OidcAuthConfig): Promise<string | undefined> => {
  if (!isBrowserRuntime()) {
    return undefined;
  }
  const resolved = resolveAuthConfig(config);
  const manager = getAuthUserManager(resolved);
  const signOutChannel = getSignOutChannel(resolved.authority, resolved.clientId);
  const generation = signOutChannel.generation();

  const user = await withTimeout(manager.getUser(), resolved.timeoutMs, AUTH_TIMEOUT_MESSAGES.accessTokenLookup);
  if (user === null) {
    return undefined;
  }
  const current = user.expired === true ? await renewAccessToken(manager, resolved) : user;
  return signOutChannel.generation() === generation ? getAccessToken(current) : undefined;
};
