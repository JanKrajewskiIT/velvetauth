import type { JSX } from 'solid-js';

import { AuthContext } from './auth-context.ts';
import { createAuthContextValue } from './auth-controller.ts';
import type { OidcAuthConfig } from './config.ts';

export interface AuthProviderProps {
  readonly config: OidcAuthConfig;
  readonly children?: JSX.Element;
}

export const AuthProvider = (props: AuthProviderProps): JSX.Element => {
  const auth = createAuthContextValue(() => props.config);
  return <AuthContext.Provider value={auth}>{props.children}</AuthContext.Provider>;
};
