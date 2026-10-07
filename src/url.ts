export const APP_ROOT_PATH = '/';

export const parseUrl = (value: string, base: string): URL | null => {
  try {
    return new URL(value, base);
  } catch {
    // Malformed input is an expected outcome; every caller maps it to a safe value.
    return null;
  }
};

export const trimTrailingSlash = (value: string): string =>
  value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;
