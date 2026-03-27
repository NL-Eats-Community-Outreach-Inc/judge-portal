import { LearnworldsFetchResponse, LearnworldsProgressRecord } from './types';

interface LearnworldsClientConfig {
  tokenUrl: string;
  apiBaseUrl: string;
  progressEndpoint: string;
  clientId: string;
  clientSecret: string;
  clientHeaderValue: string;
  timeoutMs: number;
}

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export class LearnworldsConfigError extends Error {
  code = 'LEARNWORLDS_CONFIG_ERROR';
}

export class LearnworldsAuthError extends Error {
  code = 'LEARNWORLDS_AUTH_FAILED';
}

export class LearnworldsFetchError extends Error {
  code = 'LEARNWORLDS_FETCH_FAILED';
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new LearnworldsConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getClientConfig(): LearnworldsClientConfig {
  const tokenUrl = getRequiredEnv('LEARNWORLDS_TOKEN_URL');
  const apiBaseUrl = getRequiredEnv('LEARNWORLDS_API_BASE_URL');
  const progressEndpoint = process.env.LEARNWORLDS_PROGRESS_ENDPOINT?.trim() || '/progress';
  const clientId = getRequiredEnv('LEARNWORLDS_CLIENT_ID');
  const clientSecret = getRequiredEnv('LEARNWORLDS_CLIENT_SECRET');
  const clientHeaderValue = getRequiredEnv('LEARNWORLDS_CLIENT_HEADER_VALUE');
  const timeoutMs = Number.parseInt(process.env.LEARNWORLDS_TIMEOUT_MS || '15000', 10);

  if (!tokenUrl.startsWith('https://') || !apiBaseUrl.startsWith('https://')) {
    throw new LearnworldsConfigError('LearnWorlds URLs must use HTTPS');
  }

  return {
    tokenUrl,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    progressEndpoint: progressEndpoint.startsWith('/') ? progressEndpoint : `/${progressEndpoint}`,
    clientId,
    clientSecret,
    clientHeaderValue,
    timeoutMs: Number.isNaN(timeoutMs) ? 15000 : timeoutMs,
  };
}

function readStringValue(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}

function readNumberValue(input: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function normalizeProgressRecord(raw: Record<string, unknown>): LearnworldsProgressRecord | null {
  const learnerId = readStringValue(raw, ['learner_id', 'learnerId', 'user_id', 'userId']);
  const courseId = readStringValue(raw, ['course_id', 'courseId', 'product_id', 'productId']);

  if (!learnerId || !courseId) {
    return null;
  }

  return {
    learnerId,
    courseId,
    moduleId: readStringValue(raw, ['module_id', 'moduleId']),
    lessonId: readStringValue(raw, ['lesson_id', 'lessonId', 'activity_id', 'activityId']),
    completionStatus: readStringValue(raw, ['completion_status', 'completionStatus', 'status']),
    progressPercentage: readNumberValue(raw, [
      'progress_percentage',
      'progressPercentage',
      'progress',
    ]),
    lastActivityTimestamp: readStringValue(raw, [
      'last_activity_timestamp',
      'lastActivityTimestamp',
      'last_activity_at',
      'updated_at',
    ]),
    raw,
  };
}

function parseResponsePayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => {
      return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
    });
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const container = payload as Record<string, unknown>;
  const candidateKeys = ['data', 'results', 'items', 'progress', 'activities'];

  for (const key of candidateKeys) {
    const value = container[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => {
        return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
      });
    }
  }

  return [];
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(config: LearnworldsClientConfig): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetchWithTimeout(
    config.tokenUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
    },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new LearnworldsAuthError(`Token request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OAuthTokenResponse;
  if (!payload.access_token) {
    throw new LearnworldsAuthError('Token response did not include access_token');
  }

  return payload.access_token;
}

async function fetchWithRetries(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxRetries = 2
): Promise<Response> {
  let attempt = 0;

  while (attempt <= maxRetries) {
    const response = await fetchWithTimeout(url, init, timeoutMs);

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    if (attempt === maxRetries) {
      return response;
    }

    const retryDelayMs = 500 * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    attempt += 1;
  }

  throw new LearnworldsFetchError('Unexpected retry flow for LearnWorlds request');
}

export async function fetchLearnworldsProgressData(): Promise<LearnworldsFetchResponse> {
  const config = getClientConfig();
  const token = await getAccessToken(config);

  const endpoint = `${config.apiBaseUrl}${config.progressEndpoint}`;
  const response = await fetchWithRetries(
    endpoint,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Lw-Client': config.clientHeaderValue,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new LearnworldsFetchError(
      `LearnWorlds progress fetch failed with status ${response.status}`
    );
  }

  const rawPayload = await response.json();
  const rawRecords = parseResponsePayload(rawPayload);
  const records = rawRecords
    .map(normalizeProgressRecord)
    .filter((record): record is LearnworldsProgressRecord => record !== null);

  return {
    records,
    endpoint: config.progressEndpoint,
    httpStatus: response.status,
  };
}
