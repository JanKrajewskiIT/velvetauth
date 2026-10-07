import type { User } from 'oidc-client-ts';
import type { Accessor } from 'solid-js';
import { createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js';

import type { AuthContextValue } from './auth-context.ts';
import type { AuthState } from './auth-state.ts';
import { authenticated, unauthenticated } from './auth-state.ts';
import type { CallbackOutcome } from './callback.ts';
import { completeRedirectCallback, discardCallback } from './callback.ts';
import type { OidcAuthConfig, ResolvedAuthConfig } from './config.ts';
import { getAccountUrl, resolveAuthConfig } from './config.ts';
import { AUTH_TIMEOUT_MESSAGES, toErrorMessage } from './errors.ts';
import { isExternalOperationPending } from './external-operations.ts';
import type { BootstrapPlan } from './hydration.ts';
import { captureMountSnapshot } from './hydration.ts';
import {
  ADMIN_ROLE,
  extractRolesFromAccessToken,
  getAccessToken,
  getEmail,
  getFirstName,
  getLastName,
  getUsername,
  matchesAnyRole,
  matchesRole,
  MODERATOR_ROLE,
} from './identity.ts';
import { isBrowserRuntime } from './runtime.ts';
import { subscribeToSessionEvents } from './session-events.ts';
import type { SignInOptions } from './sign-in.ts';
import { requestSignIn } from './sign-in.ts';
import { requestSignOut } from './sign-out.ts';
import { getSignOutChannel } from './sign-out-channel.ts';
import { removeStoredUser } from './storage.ts';
import { withTimeout } from './timeout.ts';
import type { AuthUserManager } from './user-manager.ts';
import { getAuthUserManager } from './user-manager.ts';

/**
 * Owns the provider's state and lifecycle. Must run under a reactive owner so its cleanup is registered.
 * The configuration is snapshotted once for hydration, subscriptions, and bootstrap; operations and
 * non-identity fields read the live configuration.
 */
export const createAuthContextValue = (config: Accessor<OidcAuthConfig>): AuthContextValue => {
  const snapshot = untrack(() => captureMountSnapshot(config()));
  const [state, setState] = createSignal(snapshot.initialState);
  let disposed = false;
  let eventEpoch = 0;
  let renewalRun = 0;
  onCleanup(() => {
    disposed = true;
  });

  const commit = (transition: (previous: AuthState) => AuthState): void => {
    if (!disposed) {
      setState(transition);
    }
  };

  /** Event-driven commits supersede any lookup that started before them. */
  const commitEvent = (transition: (previous: AuthState) => AuthState): void => {
    eventEpoch += 1;
    commit(transition);
  };

  const processCallback = async (plan: BootstrapPlan, manager: AuthUserManager): Promise<void> => {
    let outcome: CallbackOutcome;
    try {
      outcome = await completeRedirectCallback(plan.config, () => manager, { isActive: () => !disposed });
    } catch (error) {
      commit(() => unauthenticated(toErrorMessage(error)));
      return;
    }
    const cleanupError = outcome.fallbackError === undefined ? null : toErrorMessage(outcome.fallbackError);
    commit(() => ({ ...authenticated(outcome.user), error: cleanupError }));
  };

  const lookupUser = async (plan: BootstrapPlan, manager: AuthUserManager): Promise<void> => {
    const startedEpoch = eventEpoch;
    let next: AuthState;
    try {
      const user = await withTimeout(manager.getUser(), plan.config.timeoutMs, AUTH_TIMEOUT_MESSAGES.bootstrap);
      next = user === null ? unauthenticated() : authenticated(user);
    } catch (error) {
      next = unauthenticated(toErrorMessage(error));
    }
    if (eventEpoch === startedEpoch) {
      commit(() => next);
    }
  };

  const startSession = (plan: BootstrapPlan): void => {
    const { authority, clientId } = plan.config;
    let manager: AuthUserManager;
    try {
      manager = getAuthUserManager(plan.config);
    } catch (error) {
      if (plan.isCallback) {
        discardCallback(plan.config);
      }
      commit(() => unauthenticated(toErrorMessage(error)));
      return;
    }
    const signOutChannel = getSignOutChannel(authority, clientId);

    const unsubscribeEvents = subscribeToSessionEvents(manager, {
      // Events caused by the off-component getter must not leak into this provider's state.
      onUserLoaded: (user) => {
        if (!isExternalOperationPending(manager)) {
          commitEvent(() => authenticated(user));
        }
      },
      onUserUnloaded: () => {
        if (disposed) {
          return;
        }
        commitEvent(() => unauthenticated());
        signOutChannel.publish();
      },
      onSilentRenewError: (error) => {
        if (!isExternalOperationPending(manager)) {
          commitEvent((previous) => ({ ...previous, error: toErrorMessage(error) }));
        }
      },
      onAccessTokenExpired: () => {
        commitEvent((previous) => ({ ...previous, user: null }));
      },
    });
    const unsubscribeRemoteSignOut = signOutChannel.subscribe(() => {
      if (disposed) {
        return;
      }
      removeStoredUser(authority, clientId);
      commitEvent(() => unauthenticated());
    });
    onCleanup(() => {
      unsubscribeEvents();
      unsubscribeRemoteSignOut();
    });

    void (plan.isCallback ? processCallback(plan, manager) : lookupUser(plan, manager));
  };

  const bootstrapPlan = snapshot.bootstrap;
  if (bootstrapPlan !== null) {
    onMount(() => {
      startSession(bootstrapPlan);
    });
  }

  const runContextOperation = async (operation: (resolved: ResolvedAuthConfig) => Promise<void>): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }
    try {
      await operation(resolveAuthConfig(config()));
    } catch (error) {
      commit((previous) => ({ ...previous, error: toErrorMessage(error) }));
      return;
    }
    commit((previous) => ({ ...previous, error: null }));
  };

  const signIn = (returnUrl?: string, options?: SignInOptions): Promise<void> =>
    runContextOperation((resolved) => requestSignIn(resolved, returnUrl, options));

  const signOut = (): Promise<void> => runContextOperation(requestSignOut);

  const signInSilent = async (): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }
    renewalRun += 1;
    const run = renewalRun;
    let isInvalidatedBySignOut = (): boolean => false;
    const isAbandoned = (): boolean => disposed || run !== renewalRun || isInvalidatedBySignOut();

    commit((previous) => ({ ...previous, isLoading: true }));
    try {
      const resolved = resolveAuthConfig(config());
      const manager = getAuthUserManager(resolved);
      const signOutChannel = getSignOutChannel(resolved.authority, resolved.clientId);
      const generation = signOutChannel.generation();
      isInvalidatedBySignOut = () => signOutChannel.generation() !== generation;

      const user = await withTimeout(manager.signinSilent(), resolved.timeoutMs, AUTH_TIMEOUT_MESSAGES.silentRenewal);
      if (!isAbandoned()) {
        commit((previous) => (user === null ? { ...previous, isLoading: false, error: null } : authenticated(user)));
      }
    } catch (error) {
      if (!isAbandoned()) {
        commit((previous) => ({ ...previous, isLoading: false, error: toErrorMessage(error) }));
      }
    }
  };

  const user = createMemo<User | null>(() => state().user);
  const isLoading = createMemo(() => state().isLoading);
  const error = createMemo(() => state().error);
  const isAuthenticated = createMemo(() => {
    const current = user();
    return current !== null && current.expired !== true;
  });
  const accessToken = createMemo(() => getAccessToken(user()));
  const roles = createMemo(() => extractRolesFromAccessToken(accessToken()));
  const hasRole = (role: string): boolean => matchesRole(roles(), role);

  const firstName = createMemo(() => getFirstName(user()));
  const lastName = createMemo(() => getLastName(user()));
  const email = createMemo(() => getEmail(user()));
  const username = createMemo(() => getUsername(user()));
  const accountUrl = createMemo(() => getAccountUrl(config()));
  const isAdmin = createMemo(() => hasRole(ADMIN_ROLE));
  const isModerator = createMemo(() => hasRole(MODERATOR_ROLE));
  const isAdminOrModerator = createMemo(() => isAdmin() || isModerator());

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    accessToken,
    roles,
    firstName,
    lastName,
    email,
    username,
    accountUrl,
    hasRole,
    hasAnyRole: (...required) => matchesAnyRole(roles(), ...required),
    isAdmin,
    isModerator,
    isAdminOrModerator,
    signIn,
    signOut,
    signInSilent,
  };
};
