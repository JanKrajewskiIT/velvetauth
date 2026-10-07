import type { User } from 'oidc-client-ts';
import type { Accessor } from 'solid-js';
import { createContext, useContext } from 'solid-js';

import { AUTH_ERROR_MESSAGES } from './errors.ts';
import type { SignInOptions } from './sign-in.ts';

export interface AuthContextValue {
  readonly user: Accessor<User | null>;
  readonly isLoading: Accessor<boolean>;
  readonly isAuthenticated: Accessor<boolean>;
  readonly error: Accessor<string | null>;
  readonly accessToken: Accessor<string | undefined>;
  readonly roles: Accessor<readonly string[]>;
  readonly firstName: Accessor<string>;
  readonly lastName: Accessor<string>;
  readonly email: Accessor<string>;
  readonly username: Accessor<string>;
  readonly accountUrl: Accessor<string>;
  readonly hasRole: (role: string) => boolean;
  readonly hasAnyRole: (...roles: string[]) => boolean;
  readonly isAdmin: Accessor<boolean>;
  readonly isModerator: Accessor<boolean>;
  readonly isAdminOrModerator: Accessor<boolean>;
  readonly signIn: (returnUrl?: string, options?: SignInOptions) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly signInSilent: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>();

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (value === undefined) {
    throw new Error(AUTH_ERROR_MESSAGES.providerRequired);
  }
  return value;
};
