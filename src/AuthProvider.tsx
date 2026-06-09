import type { SigninRedirectArgs, User } from 'oidc-client-ts';
import {
  type Accessor,
  type Component,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  untrack,
  useContext,
} from 'solid-js';

import { exchangeCallback } from './callback';
import { getAccountUrl, getRedirectUri, getReturnUrlStorageKey, getTimeoutMs, type OidcAuthConfig } from './config';
import {
  ADMIN_ROLE,
  HOOK_OUTSIDE_PROVIDER_MESSAGE,
  INITIALIZATION_TIMEOUT_MESSAGE,
  MODERATOR_ROLE,
  SILENT_RENEW_TIMEOUT_MESSAGE,
} from './constants';
import { formatSilentRenewError, messageOf } from './errors';
import { extractRolesFromAccessToken, matchesAnyRole, matchesRole } from './jwt';
import { getCurrentReturnUrl, isOidcCallbackReturnUrl, normalizeReturnUrl } from './return-url';
import { isBrowserRuntime, withTimeout } from './runtime';
import {
  buildBroadcastChannelName,
  getStoredUser,
  removeReturnUrlFallback,
  removeStoredUser,
  writeReturnUrlFallback,
} from './storage';
import { resolveUserManager } from './user-manager';

export interface SignInOptions {
  acrValues?: string;
  prompt?: string;
  loginHint?: string;
  uiLocales?: string;
  extraQueryParams?: Record<string, string>;
}

export interface AuthContextValue {
  user: Accessor<User | null>;
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  error: Accessor<string | null>;
  accessToken: Accessor<string | undefined>;
  roles: Accessor<string[]>;
  firstName: Accessor<string>;
  lastName: Accessor<string>;
  email: Accessor<string>;
  username: Accessor<string>;
  accountUrl: Accessor<string>;
  isAdmin: Accessor<boolean>;
  isModerator: Accessor<boolean>;
  isAdminOrModerator: Accessor<boolean>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
  signIn: (returnUrl?: string, options?: SignInOptions) => Promise<void>;
  signOut: () => Promise<void>;
  signInSilent: () => Promise<void>;
}

export interface AuthProviderProps {
  config: OidcAuthConfig;
  children?: JSX.Element;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

const RESERVED_QUERY_PARAMS = new Set([
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

const AuthContext = createContext<AuthContextValue>();

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return '';
}

function buildSigninRequestArgs(options?: SignInOptions): Partial<SigninRedirectArgs> {
  const args: Record<string, unknown> = {};
  if (!options) {
    return args;
  }

  if (isPresent(options.acrValues)) {
    args.acr_values = options.acrValues;
  }
  if (isPresent(options.prompt)) {
    args.prompt = options.prompt;
  }
  if (isPresent(options.loginHint)) {
    args.login_hint = options.loginHint;
  }
  if (isPresent(options.uiLocales)) {
    args.ui_locales = options.uiLocales;
  }

  if (options.extraQueryParams) {
    const extra: Record<string, string> = {};
    for (const [key, value] of Object.entries(options.extraQueryParams)) {
      if (RESERVED_QUERY_PARAMS.has(key) || !isPresent(value)) {
        continue;
      }
      extra[key] = value;
    }
    if (Object.keys(extra).length > 0) {
      args.extraQueryParams = extra;
    }
  }

  return args;
}

export const AuthProvider: Component<AuthProviderProps> = (props) => {
  const browser = isBrowserRuntime();
  const mountAuthority = untrack(() => props.config.authority);
  const mountClientId = untrack(() => props.config.clientId);
  const mountRedirectUri = untrack(() => getRedirectUri(props.config));
  const isCallback = browser && isOidcCallbackReturnUrl(getCurrentReturnUrl(), mountRedirectUri);

  const [state, setState] = createSignal<AuthState>({
    user: browser ? getStoredUser(mountAuthority, mountClientId) : null,
    isLoading: isCallback,
    error: null,
  });

  let disposed = false;
  let lifecycleEpoch = 0;
  onCleanup(() => {
    disposed = true;
  });

  const user = createMemo(() => state().user);
  const isLoading = createMemo(() => state().isLoading);
  const error = createMemo(() => state().error);
  const accessToken = createMemo(() => state().user?.access_token);
  const isAuthenticated = createMemo(() => {
    const current = state().user;
    return current != null && current.expired !== true;
  });
  const roles = createMemo(() => extractRolesFromAccessToken(state().user?.access_token));

  const firstName = createMemo(() => {
    const profile = state().user?.profile;
    return profile ? firstNonEmpty(profile.given_name, profile.first_name) : '';
  });
  const lastName = createMemo(() => {
    const profile = state().user?.profile;
    return profile ? firstNonEmpty(profile.family_name, profile.last_name) : '';
  });
  const email = createMemo(() => firstNonEmpty(state().user?.profile.email));
  const username = createMemo(() => {
    const profile = state().user?.profile;
    return profile ? firstNonEmpty(profile.preferred_username, profile.name, profile.sub) : '';
  });
  const accountUrl = createMemo(() => getAccountUrl(props.config));

  const isAdmin = createMemo(() => matchesRole(roles(), ADMIN_ROLE));
  const isModerator = createMemo(() => matchesRole(roles(), MODERATOR_ROLE));
  const isAdminOrModerator = createMemo(() => isAdmin() || isModerator());

  const hasRole = (role: string): boolean => matchesRole(roles(), role);
  const hasAnyRole = (...requiredRoles: string[]): boolean => matchesAnyRole(roles(), ...requiredRoles);

  const applyUnauthenticated = (clearError: boolean): void => {
    lifecycleEpoch += 1;
    setState((previous) => ({
      user: null,
      isLoading: false,
      error: clearError ? null : previous.error,
    }));
  };

  const signIn = async (returnUrl?: string, options?: SignInOptions): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }

    const manager = resolveUserManager(props.config);
    const storageKey = getReturnUrlStorageKey(props.config);
    const redirectUri = getRedirectUri(props.config);

    let safeReturnUrl: string | undefined;
    if (returnUrl !== undefined) {
      const normalized = normalizeReturnUrl(returnUrl);
      if (!isOidcCallbackReturnUrl(normalized, redirectUri)) {
        safeReturnUrl = normalized;
      }
    }

    let persisted = false;
    try {
      const args: SigninRedirectArgs = buildSigninRequestArgs(options);
      if (safeReturnUrl) {
        writeReturnUrlFallback(storageKey, safeReturnUrl);
        persisted = true;
        args.state = { returnUrl: safeReturnUrl };
      }
      await manager.signinRedirect(args);
    } catch (caught) {
      if (persisted) {
        removeReturnUrlFallback(storageKey);
      }
      setState((previous) => ({ ...previous, error: messageOf(caught) }));
    }
  };

  const signOut = async (): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }
    const manager = resolveUserManager(props.config);
    try {
      await manager.signoutRedirect();
    } catch (caught) {
      setState((previous) => ({ ...previous, error: messageOf(caught) }));
    }
  };

  const signInSilent = async (): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }
    const manager = resolveUserManager(props.config);
    const epoch = lifecycleEpoch;
    setState((previous) => ({ ...previous, isLoading: true }));
    try {
      const renewed = await withTimeout(
        manager.signinSilent(),
        getTimeoutMs(props.config),
        SILENT_RENEW_TIMEOUT_MESSAGE,
      );
      if (disposed || lifecycleEpoch !== epoch) {
        return;
      }
      setState((previous) => ({
        user: renewed ?? previous.user,
        isLoading: false,
        error: null,
      }));
    } catch (caught) {
      if (disposed || lifecycleEpoch !== epoch) {
        return;
      }
      setState((previous) => ({ ...previous, isLoading: false, error: messageOf(caught) }));
    }
  };

  onMount(() => {
    if (!isBrowserRuntime()) {
      return;
    }

    const manager = resolveUserManager(props.config);

    const channelName = buildBroadcastChannelName(mountAuthority, mountClientId);
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName);
      channel.onmessage = (event: MessageEvent) => {
        if (disposed) {
          return;
        }
        if ((event.data as { kind?: unknown } | null)?.kind === 'signed-out') {
          removeStoredUser(mountAuthority, mountClientId);
          applyUnauthenticated(true);
        }
      };
    }

    const onUserLoaded = (loaded: User): void => {
      if (disposed) {
        return;
      }
      setState({ user: loaded, isLoading: false, error: null });
    };

    const onUserUnloaded = (): void => {
      if (disposed) {
        return;
      }
      applyUnauthenticated(true);
      channel?.postMessage({ kind: 'signed-out' });
    };

    const onSilentRenewError = (renewError: Error): void => {
      if (disposed) {
        return;
      }
      setState((previous) => ({ ...previous, error: formatSilentRenewError(renewError) }));
    };

    const onAccessTokenExpired = (): void => {
      if (disposed) {
        return;
      }
      setState((previous) => ({ ...previous, user: null }));
    };

    manager.events.addUserLoaded(onUserLoaded);
    manager.events.addUserUnloaded(onUserUnloaded);
    manager.events.addSilentRenewError(onSilentRenewError);
    manager.events.addAccessTokenExpired(onAccessTokenExpired);

    onCleanup(() => {
      manager.events.removeUserLoaded(onUserLoaded);
      manager.events.removeUserUnloaded(onUserUnloaded);
      manager.events.removeSilentRenewError(onSilentRenewError);
      manager.events.removeAccessTokenExpired(onAccessTokenExpired);
      channel?.close();
    });

    void bootstrap(manager);
  });

  async function bootstrap(manager: ReturnType<typeof resolveUserManager>): Promise<void> {
    try {
      if (isCallback) {
        const outcome = await exchangeCallback(manager, props.config);
        if (disposed) {
          return;
        }
        setState({ user: outcome.user, isLoading: false, error: outcome.error });
        return;
      }

      const loaded = await withTimeout(manager.getUser(), getTimeoutMs(props.config), INITIALIZATION_TIMEOUT_MESSAGE);
      if (disposed) {
        return;
      }
      setState({ user: loaded, isLoading: false, error: null });
    } catch (caught) {
      if (disposed) {
        return;
      }
      setState({ user: null, isLoading: false, error: messageOf(caught) });
    }
  }

  const value: AuthContextValue = {
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

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(HOOK_OUTSIDE_PROVIDER_MESSAGE);
  }
  return context;
}
