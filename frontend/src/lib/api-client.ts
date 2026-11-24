import type { PaginationMeta } from '../types/api';

const API_BASE = '/api/v1';

export interface ApiErrorDetail {
  path: string;
  message: string;
  code: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

type RawEnvelope<T> = ApiEnvelope<T> | ErrorEnvelope;

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  body?: BodyInit | null;
}

export const apiRequest = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiEnvelope<T>> => {
  const { json, headers, ...rest } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: json === undefined ? (rest.body ?? null) : JSON.stringify(json),
  });

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const payload = (await response.json().catch(() => null)) as RawEnvelope<T> | null;

  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;

    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details,
    );
  }

  if (!payload || !('data' in payload)) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response.',
    );
  }

  return payload;
};

type QueryValue = string | number | boolean | undefined | null;

export const toQueryString = (params: Record<string, QueryValue>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const serialized = search.toString();

  return serialized ? `?${serialized}` : '';
};

export const requireMeta = (meta: PaginationMeta | undefined): PaginationMeta => {
  if (!meta) {
    throw new ApiError(
      500,
      'INVALID_RESPONSE',
      'The server response is missing pagination metadata.',
    );
  }

  return meta;
};
