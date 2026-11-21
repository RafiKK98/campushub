import 'dotenv/config';

// Ensure test environment variables are set before any module imports env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-chars-long';
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.AUTH_COOKIE_SAME_SITE = 'lax';
process.env.AUTH_TOKEN_TTL_SECONDS = '3600';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '900000';
process.env.TRUST_PROXY = '1';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
// DATABASE_URL and DIRECT_URL are loaded from .env via dotenv/config above
