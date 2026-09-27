import type { User } from 'oidc-client-ts';
import type { SigninRedirectArgs } from 'oidc-client-ts';
import { batch, createContext, createMemo, createSignal, onCleanup, onMount, untrack, useContext } from 'solid-js';

import { cleanupFailedAuthCallback, processAuthRedirectCallback } from './callback';
import { getAccountUrl, getConfigIdentity, getReturnUrlStorageKey, getTimeoutMs } from './config';
import {
  clearPersistedUserAfterRemoteSignOut,
  getSignOutGeneration,
  publishSignOut,
  subscribeToSignOut,
} from './cross-tab';
import { getInteractionErrorMessage, getSafeErrorMessage } from './errors';
import { extractRolesFromAccessToken, matchesAnyRole, matchesRole } from './identity';
import { subscribeToManagerEvents } from './manager-events';
import { beginManagedRenewal, hasManagedRenewal } from './renewal-state';
import { isOidcCallbackReturnUrl, normalizeReturnUrl } from './return-url';
import { isBrowserRuntime, withTimeout } from './runtime';
import { getStoredUser, removeReturnUrl, writeReturnUrl } from './storage';
import type { AuthContextValue, AuthProviderProps, AuthUserManager, OidcAuthConfig, SignInOptions } from './types';
import { getAuthUserManager } from './user-manager';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>();
const RESERVED_QUERY_KEYS = new Set([
  'redirect_uri',
  'response_type',
  'client_id',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
  'response_mode',
  'display',
  'max_age',
  'id_token_hint',
  'acr_values',
  'prompt',
  'login_hint',
  'ui_locales',
]);

const firstString = (...values: unknown[]): string => {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.length > 0);
  return typeof value === 'string' ? value : '';
};

const getProfileValue = (user: User | null, ...keys: string[]): string => {
  if (!user) return '';
  return firstString(...keys.map((key) => user.profile[key]));
};

const sanitizeSignInOptions = (options?: SignInOptions): SigninRedirectArgs => {
  if (!options) return {};
  const args: SigninRedirectArgs = {};
  if (options.acrValues) args.acr_values = options.acrValues;
  if (options.prompt) args.prompt = options.prompt;
  if (options.loginHint) args.login_hint = options.loginHint;
  if (options.uiLocales) args.ui_locales = options.uiLocales;

  const extraQueryParams = Object.fromEntries(
    Object.entries(options.extraQueryParams ?? {}).filter(
      ([key, value]) => typeof value === 'string' && value !== '' && !RESERVED_QUERY_KEYS.has(key.toLowerCase()),
    ),
  );
  if (Object.keys(extraQueryParams).length > 0) args.extraQueryParams = extraQueryParams;
  return args;
};

export const AuthProvider = (props: AuthProviderProps) => {
  const initialConfig = untrack(() => ({ ...props.config }));
  const browser = isBrowserRuntime();
  const callbackPath = initialConfig.redirectUri ?? initialConfig.appUrl;
  const isCallback = browser && isOidcCallbackReturnUrl(window.location.href, callbackPath, window.location.origin);
  const [state, setState] = createSignal<AuthState>(
    {
      user: browser ? getStoredUser(initialConfig.authority, initialConfig.clientId) : null,
      isLoading: isCallback,
      error: null,
    },
    { equals: false },
  );
  let disposed = false;
  let activeManualRenewals = 0;

  const currentConfig = createMemo((): OidcAuthConfig => ({ ...props.config }));
  const user = createMemo(() => state().user);
  const isLoading = createMemo(() => state().isLoading);
  const error = createMemo(() => state().error);
  const isAuthenticated = createMemo(() => {
    const currentUser = user();
    return currentUser !== null && !currentUser.expired;
  });
  const accessToken = createMemo(() => user()?.access_token);
  const roles = createMemo(() => extractRolesFromAccessToken(accessToken()));
  const firstName = createMemo(() => getProfileValue(user(), 'given_name', 'first_name'));
  const lastName = createMemo(() => getProfileValue(user(), 'family_name', 'last_name'));
  const email = createMemo(() => getProfileValue(user(), 'email'));
  const username = createMemo(() => getProfileValue(user(), 'preferred_username', 'name', 'sub'));
  const accountUrl = createMemo(() => getAccountUrl(currentConfig()));
  const hasRole = (role: string): boolean => matchesRole(roles(), role);
  const hasAnyRole = (...requiredRoles: string[]): boolean => matchesAnyRole(roles(), ...requiredRoles);
  const isAdmin = createMemo(() => hasRole('admin'));
  const isModerator = createMemo(() => hasRole('moderator'));
  const isAdminOrModerator = createMemo(() => hasRole('admin') || hasRole('moderator'));

  const signIn = async (returnUrl?: string, options?: SignInOptions): Promise<void> => {
    if (!isBrowserRuntime()) return;
    const config = currentConfig();
    const normalized = returnUrl === undefined ? undefined : normalizeReturnUrl(returnUrl);
    const safeReturnUrl =
      normalized && !isOidcCallbackReturnUrl(normalized, config.redirectUri ?? config.appUrl, window.location.origin)
        ? normalized
        : undefined;
    let fallbackWritten = false;

    try {
      const manager = getAuthUserManager(config);
      if (safeReturnUrl) {
        writeReturnUrl(getReturnUrlStorageKey(config), safeReturnUrl);
        fallbackWritten = true;
      }
      await withTimeout(
        manager.signinRedirect({
          ...sanitizeSignInOptions(options),
          ...(safeReturnUrl ? { state: { returnUrl: safeReturnUrl } } : {}),
        }),
        getTimeoutMs(config),
        'Sign-in redirect timed out.',
      );
      if (!disposed) setState((previous) => ({ ...previous, error: null }));
    } catch (caught: unknown) {
      if (fallbackWritten) {
        try {
          removeReturnUrl(getReturnUrlStorageKey(config));
        } catch {
          // Preserve the redirect failure; the return URL was written by this operation.
        }
      }
      if (!disposed) setState((previous) => ({ ...previous, error: getSafeErrorMessage(caught) }));
    }
  };

  const signOut = async (): Promise<void> => {
    if (!isBrowserRuntime()) return;
    const config = currentConfig();
    const hadUser = state().user !== null;
    if (!hadUser) publishSignOut(config.authority, config.clientId);
    try {
      const manager = getAuthUserManager(config);
      await withTimeout(manager.signoutRedirect(), getTimeoutMs(config), 'Sign-out redirect timed out.');
      if (!disposed) setState((previous) => ({ ...previous, error: null }));
    } catch (caught: unknown) {
      if (!disposed) setState((previous) => ({ ...previous, error: getSafeErrorMessage(caught) }));
    }
  };

  const signInSilent = async (): Promise<void> => {
    if (!isBrowserRuntime()) return;
    const config = currentConfig();
    const generation = getSignOutGeneration(config.authority, config.clientId);
    activeManualRenewals += 1;
    setState((previous) => ({ ...previous, isLoading: true }));
    try {
      const manager = getAuthUserManager(config);
      const finishManagedRenewal = beginManagedRenewal(getConfigIdentity(config));
      let renewal: ReturnType<typeof manager.signinSilent>;
      try {
        renewal = manager.signinSilent();
      } catch (caught: unknown) {
        finishManagedRenewal();
        throw caught;
      }
      renewal.then(finishManagedRenewal, finishManagedRenewal);
      const renewedUser = await withTimeout(renewal, getTimeoutMs(config), 'Silent renewal timed out.');
      if (disposed || generation !== getSignOutGeneration(config.authority, config.clientId)) return;
      setState((previous) => ({
        ...previous,
        ...(renewedUser ? { user: renewedUser } : {}),
        isLoading: activeManualRenewals > 1,
        error: null,
      }));
    } catch (caught: unknown) {
      if (!disposed && generation === getSignOutGeneration(config.authority, config.clientId)) {
        setState((previous) => ({
          ...previous,
          isLoading: activeManualRenewals > 1,
          error: getSafeErrorMessage(caught),
        }));
      }
    } finally {
      activeManualRenewals -= 1;
      if (!disposed && generation === getSignOutGeneration(config.authority, config.clientId)) {
        setState((previous) => ({ ...previous, isLoading: activeManualRenewals > 0 }));
      }
    }
  };

  const contextValue: AuthContextValue = {
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
    isAdmin,
    isModerator,
    isAdminOrModerator,
    hasRole,
    hasAnyRole,
    signIn,
    signOut,
    signInSilent,
  };

  onMount(() => {
    if (!browser) {
      setState({ user: null, isLoading: false, error: null });
      return;
    }

    const initialConfig = currentConfig();
    let manager: AuthUserManager | undefined;

    let startupError: unknown;
    try {
      manager = getAuthUserManager(initialConfig);
    } catch (caught: unknown) {
      startupError = caught;
    }

    if (!manager) {
      if (isCallback) {
        cleanupFailedAuthCallback(initialConfig);
      }
      setState({
        user: null,
        isLoading: false,
        error: getSafeErrorMessage(startupError),
      });
      return;
    }

    const activeManager = manager;
    const identity = getConfigIdentity(initialConfig);
    const startingGeneration = getSignOutGeneration(initialConfig.authority, initialConfig.clientId);

    const onUserLoaded = (loadedUser: User): void => {
      if (disposed) return;
      if (hasManagedRenewal(identity)) return;
      setState({ user: loadedUser, isLoading: false, error: null });
    };
    const onUserUnloaded = (): void => {
      if (disposed) return;
      batch(() => setState({ user: null, isLoading: false, error: null }));
      publishSignOut(initialConfig.authority, initialConfig.clientId);
    };
    const onSilentRenewError = (renewError: Error): void => {
      if (disposed) return;
      if (hasManagedRenewal(identity)) return;
      setState((previous) => ({ ...previous, error: getInteractionErrorMessage(renewError) }));
    };
    const onAccessTokenExpired = (): void => {
      if (disposed) return;
      setState((previous) => ({ ...previous, user: null }));
    };

    const removeEventHandlers = subscribeToManagerEvents(identity, activeManager, {
      userLoaded: onUserLoaded,
      userUnloaded: onUserUnloaded,
      silentRenewError: onSilentRenewError,
      accessTokenExpired: onAccessTokenExpired,
    });

    const unsubscribeSignOut = subscribeToSignOut(initialConfig.authority, initialConfig.clientId, () => {
      if (disposed) return;
      clearPersistedUserAfterRemoteSignOut(initialConfig.authority, initialConfig.clientId);
      batch(() => setState({ user: null, isLoading: false, error: null }));
    });

    onCleanup(() => {
      disposed = true;
      unsubscribeSignOut();
      removeEventHandlers();
    });

    const bootstrap = async (): Promise<void> => {
      if (isCallback) {
        try {
          const result = await processAuthRedirectCallback(initialConfig, () => !disposed);
          if (disposed || startingGeneration !== getSignOutGeneration(initialConfig.authority, initialConfig.clientId))
            return;
          setState({
            user: result.user,
            isLoading: false,
            error:
              result.cleanupError === undefined
                ? null
                : getSafeErrorMessage(result.cleanupError, 'The callback return-URL fallback could not be removed.'),
          });
        } catch (caught: unknown) {
          if (!disposed) setState({ user: null, isLoading: false, error: getSafeErrorMessage(caught) });
        }
        return;
      }

      try {
        const loadedUser = await withTimeout(
          activeManager.getUser(),
          getTimeoutMs(initialConfig),
          'Authentication initialization timed out.',
        );
        if (disposed || startingGeneration !== getSignOutGeneration(initialConfig.authority, initialConfig.clientId))
          return;
        setState({ user: loadedUser, isLoading: false, error: null });
      } catch (caught: unknown) {
        if (!disposed) setState({ user: null, isLoading: false, error: getSafeErrorMessage(caught) });
      }
    };

    void bootstrap();
  });

  return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be called inside an AuthProvider.');
  return context;
};
