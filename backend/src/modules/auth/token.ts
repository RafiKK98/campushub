import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../../config/env.js';
import type { TokenPayload } from './auth.types.js';

const ISSUER = 'campushub-api';
const AUDIENCE = 'campushub-web';
const secret = new TextEncoder().encode(env.JWT_SECRET);

export const signSessionToken = async (userId: string): Promise<string> => {
  const token = await new SignJWT({} as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(secret);

  return token;
};

export const verifySessionToken = async (token: string): Promise<TokenPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });

    const sub = payload.sub as string | undefined;
    if (!sub) {
      return null;
    }

    return { sub };
  } catch {
    return null;
  }
};
