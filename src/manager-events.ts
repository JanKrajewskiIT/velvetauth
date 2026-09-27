import type { User } from 'oidc-client-ts';

import type { AuthUserManager } from './types';

export interface AuthManagerEventHandlers {
  userLoaded(user: User): void;
  userUnloaded(): void;
  silentRenewError(error: Error): void;
  accessTokenExpired(): void;
}

interface EventHub {
  handlers: Set<AuthManagerEventHandlers>;
  manager: AuthUserManager;
  removeListeners(): void;
}

const hubs = new Map<string, EventHub>();

export const subscribeToManagerEvents = (
  identity: string,
  manager: AuthUserManager,
  handlers: AuthManagerEventHandlers,
): (() => void) => {
  let hub = hubs.get(identity);
  if (!hub) {
    const listeners = new Set<AuthManagerEventHandlers>();
    const onUserLoaded = (user: User): void => listeners.forEach((listener) => listener.userLoaded(user));
    const onUserUnloaded = (): void => listeners.forEach((listener) => listener.userUnloaded());
    const onSilentRenewError = (error: Error): void =>
      listeners.forEach((listener) => listener.silentRenewError(error));
    const onAccessTokenExpired = (): void => listeners.forEach((listener) => listener.accessTokenExpired());

    manager.events.addUserLoaded(onUserLoaded);
    manager.events.addUserUnloaded(onUserUnloaded);
    manager.events.addSilentRenewError(onSilentRenewError);
    manager.events.addAccessTokenExpired(onAccessTokenExpired);

    hub = {
      manager,
      handlers: listeners,
      removeListeners: () => {
        manager.events.removeUserLoaded(onUserLoaded);
        manager.events.removeUserUnloaded(onUserUnloaded);
        manager.events.removeSilentRenewError(onSilentRenewError);
        manager.events.removeAccessTokenExpired(onAccessTokenExpired);
      },
    };
    hubs.set(identity, hub);
  }

  if (hub.manager !== manager) {
    throw new Error('An auth event identity is already bound to a different OIDC client.');
  }
  hub.handlers.add(handlers);

  return () => {
    const current = hubs.get(identity);
    if (!current) return;
    current.handlers.delete(handlers);
    if (current.handlers.size === 0) {
      current.removeListeners();
      hubs.delete(identity);
    }
  };
};
