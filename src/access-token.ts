import { getTimeoutMs, type OidcAuthConfig } from './config';
import { ACCESS_TOKEN_LOOKUP_TIMEOUT_MESSAGE, SILENT_RENEW_TIMEOUT_MESSAGE } from './constants';
import { isBrowserRuntime, withTimeout } from './runtime';
import { resolveUserManager } from './user-manager';

export async function getAuthAccessToken(config: OidcAuthConfig): Promise<string | undefined> {
  if (!isBrowserRuntime()) {
    return undefined;
  }

  const manager = resolveUserManager(config);
  const timeoutMs = getTimeoutMs(config);

  const user = await withTimeout(manager.getUser(), timeoutMs, ACCESS_TOKEN_LOOKUP_TIMEOUT_MESSAGE);

  if (!user) {
    return undefined;
  }

  if (!user.expired) {
    return user.access_token;
  }

  try {
    const renewed = await withTimeout(manager.signinSilent(), timeoutMs, SILENT_RENEW_TIMEOUT_MESSAGE);
    return renewed?.access_token ?? undefined;
  } catch {
    return undefined;
  }
}
