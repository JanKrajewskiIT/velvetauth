import type { User } from 'oidc-client-ts';

export interface AuthState {
  readonly user: User | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export const authenticated = (user: User): AuthState => ({ user, isLoading: false, error: null });

export const unauthenticated = (error: string | null = null): AuthState => ({ user: null, isLoading: false, error });

export const hydrated = (user: User | null, isLoading: boolean): AuthState => ({ user, isLoading, error: null });
