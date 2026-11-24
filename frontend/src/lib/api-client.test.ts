import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, requireMeta, toQueryString } from './api-client';

describe('apiRequest', () => {
  it('parses the success envelope and sends relative credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<{ ok: boolean }>('/health');

    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('handles 204 No Content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await apiRequest<undefined>('/auth/logout', { method: 'POST' });

    expect(result.data).toBeUndefined();
  });

  it('throws ApiError with details when the server returns an error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input.',
              details: [{ path: 'email', message: 'Invalid', code: 'invalid' }],
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(apiRequest('/auth/login', { method: 'POST', json: {} })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input.',
      details: [{ path: 'email', message: 'Invalid', code: 'invalid' }],
    });
  });

  it('throws ApiError when the response body is invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 502 })));

    await expect(apiRequest('/courses')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('toQueryString', () => {
  it('serializes defined parameters and skips empty values', () => {
    expect(toQueryString({ page: 2, search: 'algo', empty: '', nil: null, undef: undefined })).toBe(
      '?page=2&search=algo',
    );
  });

  it('returns an empty string when no parameters are provided', () => {
    expect(toQueryString({ a: undefined, b: null, c: '' })).toBe('');
  });
});

describe('requireMeta', () => {
  it('returns metadata when present and throws when missing', () => {
    const meta = { page: 1, limit: 20, total: 5, totalPages: 1 };
    expect(requireMeta(meta)).toEqual(meta);
    expect(() => requireMeta(undefined)).toThrow(ApiError);
  });
});
