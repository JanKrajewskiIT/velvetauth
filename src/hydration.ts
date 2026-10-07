import type { AuthState } from './auth-state.ts';
import { hydrated, unauthenticated } from './auth-state.ts';
import { isCurrentUrlCallback } from './callback.ts';
import type { OidcAuthConfig, ResolvedAuthConfig } from './config.ts';
import { resolveAuthConfig } from './config.ts';
import { toErrorMessage } from './errors.ts';
import { isBrowserRuntime } from './runtime.ts';
import { getStoredUser } from './storage.ts';

export interface BootstrapPlan {
  readonly config: ResolvedAuthConfig;
  readonly isCallback: boolean;
}

export interface MountSnapshot {
  readonly initialState: AuthState;
  /** Null when no asynchronous OIDC work may start: non-browser runtime or invalid configuration. */
  readonly bootstrap: BootstrapPlan | null;
}

/** Derives the first render's state synchronously from the configuration captured at mount. */
export const captureMountSnapshot = (config: OidcAuthConfig): MountSnapshot => {
  if (!isBrowserRuntime()) {
    return { initialState: unauthenticated(), bootstrap: null };
  }
  let resolved: ResolvedAuthConfig;
  try {
    resolved = resolveAuthConfig(config);
  } catch (error) {
    return { initialState: unauthenticated(toErrorMessage(error)), bootstrap: null };
  }
  const isCallback = isCurrentUrlCallback(resolved);
  return {
    initialState: hydrated(getStoredUser(resolved.authority, resolved.clientId), isCallback),
    bootstrap: { config: resolved, isCallback },
  };
};
