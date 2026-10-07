import { buildStoredUserStorageKey } from './storage.ts';

const CHANNEL_NAME_PREFIX = 'velvet-auth:sign-out:';
const SIGNED_OUT_KIND = 'signed-out';

interface SignOutMessage {
  readonly kind: typeof SIGNED_OUT_KIND;
}

export interface SignOutChannel {
  /** Increases on every local or remote sign-out so late results started earlier can be rejected. */
  readonly generation: () => number;
  readonly publish: () => void;
  /** Observes notifications from other tabs only; the returned function removes the listener. */
  readonly subscribe: (listener: () => void) => () => void;
}

const isSignOutMessage = (data: unknown): data is SignOutMessage =>
  typeof data === 'object' && data !== null && 'kind' in data && data.kind === SIGNED_OUT_KIND;

const openBroadcastChannel = (name: string): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  try {
    return new BroadcastChannel(name);
  } catch {
    // Cross-tab sign-out is best effort; a missing transport must degrade silently.
    return null;
  }
};

const createSignOutChannel = (name: string): SignOutChannel => {
  const listeners = new Set<() => void>();
  const transport = openBroadcastChannel(name);
  let generation = 0;

  if (transport !== null) {
    transport.onmessage = (event: MessageEvent<unknown>) => {
      if (!isSignOutMessage(event.data)) {
        return;
      }
      generation += 1;
      for (const listener of [...listeners]) {
        listener();
      }
    };
  }

  return {
    generation: () => generation,
    publish: () => {
      generation += 1;
      const message: SignOutMessage = { kind: SIGNED_OUT_KIND };
      transport?.postMessage(message);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** One channel per identity for the module lifetime: the off-component getter observes it without a provider. */
const channels = new Map<string, SignOutChannel>();

export const getSignOutChannel = (authority: string, clientId: string): SignOutChannel => {
  const name = `${CHANNEL_NAME_PREFIX}${buildStoredUserStorageKey(authority, clientId)}`;
  const existing = channels.get(name);
  if (existing !== undefined) {
    return existing;
  }
  const created = createSignOutChannel(name);
  channels.set(name, created);
  return created;
};
