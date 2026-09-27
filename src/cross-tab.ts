import { buildStoredUserStorageKey, removeStoredUser } from './storage';

type SignOutListener = () => void;

interface IdentityChannel {
  channel: BroadcastChannel;
  listeners: Set<SignOutListener>;
}

const channels = new Map<string, IdentityChannel>();
const generations = new Map<string, number>();
const recentlyPublished = new Set<string>();

const getScope = (authority: string, clientId: string): string => buildStoredUserStorageKey(authority, clientId);

const getChannelName = (scope: string): string => `velvet-auth:signout:${scope}`;

const getOrCreateChannel = (scope: string): IdentityChannel | null => {
  const existing = channels.get(scope);
  if (existing) return existing;
  if (typeof BroadcastChannel === 'undefined') return null;

  try {
    const channel = new BroadcastChannel(getChannelName(scope));
    const entry: IdentityChannel = { channel, listeners: new Set() };
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      const message: unknown = event.data;
      if (typeof message !== 'object' || message === null || !('kind' in message)) return;
      if (message.kind !== 'signed-out') return;
      generations.set(scope, (generations.get(scope) ?? 0) + 1);
      entry.listeners.forEach((listener) => listener());
    });
    channels.set(scope, entry);
    return entry;
  } catch {
    return null;
  }
};

export const getSignOutGeneration = (authority: string, clientId: string): number =>
  generations.get(getScope(authority, clientId)) ?? 0;

export const subscribeToSignOut = (authority: string, clientId: string, listener: SignOutListener): (() => void) => {
  const scope = getScope(authority, clientId);
  const entry = getOrCreateChannel(scope);
  if (!entry) return () => undefined;
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      entry.channel.close();
      channels.delete(scope);
    }
  };
};

export const publishSignOut = (authority: string, clientId: string): void => {
  const scope = getScope(authority, clientId);
  if (recentlyPublished.has(scope)) return;
  recentlyPublished.add(scope);
  queueMicrotask(() => recentlyPublished.delete(scope));
  generations.set(scope, (generations.get(scope) ?? 0) + 1);
  const existing = channels.get(scope);
  let sender = existing?.channel;
  let ownsSender = false;
  if (!sender && typeof BroadcastChannel !== 'undefined') {
    try {
      sender = new BroadcastChannel(getChannelName(scope));
      ownsSender = true;
    } catch {
      return;
    }
  }
  try {
    sender?.postMessage({ kind: 'signed-out' });
  } catch {
    return;
  } finally {
    if (ownsSender) sender?.close();
  }
};

export const clearPersistedUserAfterRemoteSignOut = (authority: string, clientId: string): void => {
  try {
    removeStoredUser(authority, clientId);
  } catch {
    return;
  }
};
