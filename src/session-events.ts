import type { User } from 'oidc-client-ts';

import type { AuthUserManager } from './user-manager.ts';

export interface SessionEventHandlers {
  readonly onUserLoaded: (user: User) => void;
  readonly onUserUnloaded: () => void;
  readonly onSilentRenewError: (error: Error) => void;
  readonly onAccessTokenExpired: () => void;
}

interface EventHub {
  readonly handlers: Set<SessionEventHandlers>;
  readonly detach: () => void;
}

/** Keyed by client so any number of providers share one set of listeners on it and nothing outlives the client. */
const hubs = new WeakMap<AuthUserManager, EventHub>();

const createEventHub = (manager: AuthUserManager): EventHub => {
  const handlers = new Set<SessionEventHandlers>();
  const { events } = manager;
  const onUserLoaded = (user: User): void => {
    for (const handler of [...handlers]) {
      handler.onUserLoaded(user);
    }
  };
  const onUserUnloaded = (): void => {
    for (const handler of [...handlers]) {
      handler.onUserUnloaded();
    }
  };
  const onSilentRenewError = (error: Error): void => {
    for (const handler of [...handlers]) {
      handler.onSilentRenewError(error);
    }
  };
  const onAccessTokenExpired = (): void => {
    for (const handler of [...handlers]) {
      handler.onAccessTokenExpired();
    }
  };

  events.addUserLoaded(onUserLoaded);
  events.addUserUnloaded(onUserUnloaded);
  events.addSilentRenewError(onSilentRenewError);
  events.addAccessTokenExpired(onAccessTokenExpired);

  return {
    handlers,
    detach: () => {
      events.removeUserLoaded(onUserLoaded);
      events.removeUserUnloaded(onUserUnloaded);
      events.removeSilentRenewError(onSilentRenewError);
      events.removeAccessTokenExpired(onAccessTokenExpired);
    },
  };
};

export const subscribeToSessionEvents = (manager: AuthUserManager, handlers: SessionEventHandlers): (() => void) => {
  const hub = hubs.get(manager) ?? createEventHub(manager);
  hubs.set(manager, hub);
  hub.handlers.add(handlers);
  return () => {
    hub.handlers.delete(handlers);
    if (hub.handlers.size === 0 && hubs.get(manager) === hub) {
      hub.detach();
      hubs.delete(manager);
    }
  };
};
