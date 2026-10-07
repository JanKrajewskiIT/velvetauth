import type { SigninRedirectArgs } from 'oidc-client-ts';

import type { ResolvedAuthConfig } from './config.ts';
import { AUTH_TIMEOUT_MESSAGES } from './errors.ts';
import { createReturnUrlState, resolveSafeReturnUrl } from './return-url.ts';
import { stageReturnUrl } from './storage.ts';
import { withTimeout } from './timeout.ts';
import { getAuthUserManager } from './user-manager.ts';

export interface SignInOptions {
  readonly acrValues?: string;
  readonly prompt?: string;
  readonly loginHint?: string;
  readonly uiLocales?: string;
  readonly extraQueryParams?: Readonly<Record<string, string>>;
}

type DedicatedOption = Exclude<keyof SignInOptions, 'extraQueryParams'>;

const DEDICATED_PARAMETERS = [
  ['acrValues', 'acr_values'],
  ['prompt', 'prompt'],
  ['loginHint', 'login_hint'],
  ['uiLocales', 'ui_locales'],
] as const satisfies readonly (readonly [DedicatedOption, string])[];

type DedicatedParameter = (typeof DEDICATED_PARAMETERS)[number][1];

const FRAMEWORK_OWNED_PARAMETERS = [
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
] as const;

const RESERVED_PARAMETERS: ReadonlySet<string> = new Set<string>([
  ...FRAMEWORK_OWNED_PARAMETERS,
  ...DEDICATED_PARAMETERS.map(([, parameter]) => parameter),
]);

const isForwardable = (value: unknown): value is string => typeof value === 'string' && value !== '';

const buildDedicatedArgs = (options: SignInOptions): Partial<Record<DedicatedParameter, string>> => {
  const args: Partial<Record<DedicatedParameter, string>> = {};
  for (const [option, parameter] of DEDICATED_PARAMETERS) {
    const value = options[option];
    if (isForwardable(value)) {
      args[parameter] = value;
    }
  }
  return args;
};

const buildExtraQueryParams = (
  extraQueryParams: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined => {
  const forwarded = Object.entries(extraQueryParams ?? {}).filter(
    ([key, value]) => isForwardable(value) && !RESERVED_PARAMETERS.has(key.toLowerCase()),
  );
  return forwarded.length === 0 ? undefined : Object.fromEntries(forwarded);
};

const buildSigninRedirectArgs = (returnUrl: string | undefined, options: SignInOptions): SigninRedirectArgs => {
  const args: SigninRedirectArgs = buildDedicatedArgs(options);
  const extraQueryParams = buildExtraQueryParams(options.extraQueryParams);
  if (returnUrl !== undefined) {
    args.state = createReturnUrlState(returnUrl);
  }
  if (extraQueryParams !== undefined) {
    args.extraQueryParams = extraQueryParams;
  }
  return args;
};

export const requestSignIn = async (
  config: ResolvedAuthConfig,
  returnUrl?: string,
  options: SignInOptions = {},
): Promise<void> => {
  const manager = getAuthUserManager(config);
  const safeReturnUrl = returnUrl ? resolveSafeReturnUrl(returnUrl, config.redirectUri) : undefined;
  const staged = safeReturnUrl === undefined ? undefined : stageReturnUrl(config.returnUrlStorageKey, safeReturnUrl);
  try {
    await withTimeout(
      manager.signinRedirect(buildSigninRedirectArgs(safeReturnUrl, options)),
      config.timeoutMs,
      AUTH_TIMEOUT_MESSAGES.signIn,
    );
  } catch (error) {
    staged?.rollback();
    throw error;
  }
};
