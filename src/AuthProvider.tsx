import type { User } from 'oidc-client-ts';
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type ParentProps,
  untrack,
  useContext,
} from 'solid-js';

import type { OidcAuthConfig } from './oidc';
import { getRedirectUri, getReturnUrlStorageKey, getTimeoutMs, getUserManager } from './oidc';
import {
  extractRolesFromAccessToken,
  getCurrentReturnUrl,
  getStoredUser,
  isBrowserRuntime,
  isOidcCallbackReturnUrl,
  matchesAnyRole,
  matchesRole,
  normalizeReturnUrl,
  resolveCallbackReturnUrl,
  resolveProfileValue,
  withTimeout,
} from './utils';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue {
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
  signIn: (returnUrl?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInSilent: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
  isAdmin: Accessor<boolean>;
  isModerator: Accessor<boolean>;
  isAdminOrModerator: Accessor<boolean>;
}

interface AuthProviderProps extends ParentProps {
  config: OidcAuthConfig;
}

const AuthContext = createContext<AuthContextValue>();

const AuthProvider = (props: AuthProviderProps) => {
  const initialConfig = untrack(() => props.config);
  const initialRedirectUri = getRedirectUri(initialConfig);
  const redirectUri = (): string => getRedirectUri(props.config);
  const hasCallbackQuery = isBrowserRuntime() && isOidcCallbackReturnUrl(window.location.href, initialRedirectUri);

  const [state, setState] = createSignal<AuthState>({
    user: getStoredUser(initialConfig.authority, initialConfig.clientId),
    isLoading: hasCallbackQuery,
    error: null,
  });

  const userManager = createMemo(() => getUserManager(props.config));
  const timeoutMs = createMemo(() => getTimeoutMs(props.config));
  const returnUrlStorageKey = createMemo(() => getReturnUrlStorageKey(props.config));

  const user = createMemo(() => state().user);
  const isLoading = createMemo(() => state().isLoading);
  const error = createMemo(() => state().error);
  const isAuthenticated = createMemo(() => state().user !== null && state().user?.expired === false);
  const accessToken = createMemo(() => state().user?.access_token);
  const roles = createMemo(() => extractRolesFromAccessToken(accessToken()));

  const firstName = createMemo(() => resolveProfileValue(user(), ['given_name', 'first_name']));
  const lastName = createMemo(() => resolveProfileValue(user(), ['family_name', 'last_name']));
  const email = createMemo(() => resolveProfileValue(user(), ['email']));
  const username = createMemo(() => resolveProfileValue(user(), ['preferred_username', 'name', 'sub']));

  const isAdmin = createMemo(() => matchesRole(roles(), 'admin'));
  const isModerator = createMemo(() => matchesRole(roles(), 'moderator'));
  const isAdminOrModerator = createMemo(() => isAdmin() || isModerator());

  const accountUrl = createMemo(() => props.config.accountUrl ?? `${props.config.authority}/account`);

  const hasRole = (role: string): boolean => matchesRole(roles(), role);
  const hasAnyRole = (...requiredRoles: string[]): boolean => matchesAnyRole(roles(), ...requiredRoles);

  const signIn = async (returnUrl?: string): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }

    try {
      const normalizedReturnUrl = returnUrl ? normalizeReturnUrl(returnUrl) : undefined;
      const safeReturnUrl =
        normalizedReturnUrl && !isOidcCallbackReturnUrl(normalizedReturnUrl, redirectUri())
          ? normalizedReturnUrl
          : undefined;

      if (safeReturnUrl) {
        sessionStorage.setItem(returnUrlStorageKey(), safeReturnUrl);
      }

      await userManager().signinRedirect(safeReturnUrl ? { state: { returnUrl: safeReturnUrl } } : undefined);
    } catch (unknownError) {
      setState((previous) => ({
        ...previous,
        error: unknownError instanceof Error ? unknownError.message : 'Sign in failed',
      }));
    }
  };

  const signOut = async (): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }

    try {
      await userManager().signoutRedirect();
    } catch (unknownError) {
      setState((previous) => ({
        ...previous,
        error: unknownError instanceof Error ? unknownError.message : 'Sign out failed',
      }));
    }
  };

  const signInSilent = async (): Promise<void> => {
    if (!isBrowserRuntime()) {
      return;
    }

    try {
      const renewedUser = await withTimeout(userManager().signinSilent(), timeoutMs(), 'Silent sign in timed out');
      setState({ user: renewedUser, isLoading: false, error: null });
    } catch (unknownError) {
      setState((previous) => ({
        ...previous,
        isLoading: false,
        error: unknownError instanceof Error ? unknownError.message : 'Silent sign in failed',
      }));
    }
  };

  onMount(() => {
    if (!isBrowserRuntime()) {
      setState({ user: null, isLoading: false, error: null });
      return;
    }

    void (async () => {
      try {
        if (isOidcCallbackReturnUrl(window.location.href, redirectUri())) {
          const callbackUser = await withTimeout(
            userManager().signinRedirectCallback(),
            timeoutMs(),
            'Sign in callback timed out',
          );
          setState({ user: callbackUser, isLoading: false, error: null });

          const storedReturnUrl = sessionStorage.getItem(returnUrlStorageKey()) ?? undefined;
          sessionStorage.removeItem(returnUrlStorageKey());
          const stateReturnUrl = resolveCallbackReturnUrl(callbackUser.state, redirectUri());
          const safeStoredReturnUrl =
            storedReturnUrl && !isOidcCallbackReturnUrl(storedReturnUrl, redirectUri())
              ? normalizeReturnUrl(storedReturnUrl)
              : undefined;
          const targetReturnUrl = stateReturnUrl ?? safeStoredReturnUrl ?? '/';

          if (getCurrentReturnUrl() !== targetReturnUrl) {
            window.location.replace(targetReturnUrl);
          } else {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          }

          return;
        }

        const existingUser = await withTimeout(userManager().getUser(), timeoutMs(), 'Auth initialization timed out');
        setState({ user: existingUser, isLoading: false, error: null });
      } catch (unknownError) {
        setState({
          user: null,
          isLoading: false,
          error: unknownError instanceof Error ? unknownError.message : 'Auth initialization failed',
        });
      }
    })();
  });

  onMount(() => {
    if (!isBrowserRuntime()) {
      return;
    }

    const onUserLoaded = (loadedUser: User) => {
      setState({ user: loadedUser, isLoading: false, error: null });
    };

    const onUserUnloaded = () => {
      setState({ user: null, isLoading: false, error: null });
    };

    const onSilentRenewError = (renewError: Error) => {
      setState((previous) => ({
        ...previous,
        error: renewError.message,
      }));
    };

    const onAccessTokenExpired = () => {
      setState((previous) => ({
        ...previous,
        user: null,
      }));
    };

    userManager().events.addUserLoaded(onUserLoaded);
    userManager().events.addUserUnloaded(onUserUnloaded);
    userManager().events.addSilentRenewError(onSilentRenewError);
    userManager().events.addAccessTokenExpired(onAccessTokenExpired);

    onCleanup(() => {
      userManager().events.removeUserLoaded(onUserLoaded);
      userManager().events.removeUserUnloaded(onUserUnloaded);
      userManager().events.removeSilentRenewError(onSilentRenewError);
      userManager().events.removeAccessTokenExpired(onAccessTokenExpired);
    });
  });

  return (
    <AuthContext.Provider
      value={{
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
        signIn,
        signOut,
        signInSilent,
        hasRole,
        hasAnyRole,
        isAdmin,
        isModerator,
        isAdminOrModerator,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
};

export { AuthProvider, useAuth };
export type { AuthContextValue, AuthProviderProps };
