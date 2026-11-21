import type { Response } from 'express';
import { env } from '../../config/env.js';

const COOKIE_NAME = env.AUTH_COOKIE_NAME;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  secure: env.NODE_ENV === 'production' ? true : (env.AUTH_COOKIE_SECURE ?? false),
  maxAge: env.AUTH_TOKEN_TTL_SECONDS * 1000,
  path: '/',
} as const;

export const setSessionCookie = (response: Response, token: string): void => {
  response.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
};

export const clearSessionCookie = (response: Response): void => {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    secure: env.NODE_ENV === 'production' ? true : (env.AUTH_COOKIE_SECURE ?? false),
    path: '/',
  });
};

export const readSessionToken = (cookieHeader: string | undefined): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').reduce(
    (acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) return acc;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        acc[name] = decodeURIComponent(value);
      } catch {
        acc[name] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  return cookies[COOKIE_NAME] ?? null;
};
