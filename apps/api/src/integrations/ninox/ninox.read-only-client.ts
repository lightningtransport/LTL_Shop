import { NINOX_TRUCKS_DB } from './ninox.mapping';
import type { NinoxRecordLike } from './ninox-truck-transform';

export type NinoxReadOnlyConfig = {
  baseUrl: string;
  token: string;
  teamId: string;
  databaseId: string;
  timeoutMs?: number;
};

const PAGE_SIZE = 100;
const MAX_RECORDS = 5_000;

export class NinoxConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NinoxConfigError';
  }
}

export function getNinoxReadOnlyConfig(env: NodeJS.ProcessEnv = process.env): NinoxReadOnlyConfig {
  const baseUrl = required(env, 'NINOX_BASE_URL').replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new NinoxConfigError('NINOX_BASE_URL must be a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new NinoxConfigError('NINOX_BASE_URL must use HTTPS');
  }
  return {
    baseUrl,
    token: required(env, 'NINOX_TOKEN'),
    teamId: required(env, 'NINOX_TEAM_ID'),
    databaseId: required(env, 'NINOX_DATABASE_ID'),
    timeoutMs: positiveInteger(env, 'NINOX_TIMEOUT_MS', 20_000),
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new NinoxConfigError(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new NinoxConfigError(`${name} must be a positive integer`);
  }
  return value;
}

function segment(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('Ninox path segments cannot be empty');
  return encodeURIComponent(normalized);
}

/**
 * GET-only Ninox client for the Monday truck seed.
 * No POST/PUT/PATCH/DELETE. Seed reads TrucksDB `E` only.
 */
export class NinoxReadOnlyClient {
  constructor(
    private readonly config: NinoxReadOnlyConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async listTrucksDbRecords(): Promise<NinoxRecordLike[]> {
    return this.listTableRecords(NINOX_TRUCKS_DB.tableId);
  }

  async listTableRecords(tableId: string): Promise<NinoxRecordLike[]> {
    if (tableId !== NINOX_TRUCKS_DB.tableId) {
      throw new Error(`This seed job reads TrucksDB ${NINOX_TRUCKS_DB.tableId} only`);
    }
    const path = this.recordsPath(tableId);
    const firstPage = await this.getJson(path);
    if (!Array.isArray(firstPage)) throw new Error('Unexpected Ninox records response');

    const records = [...firstPage] as NinoxRecordLike[];
    if (records.length < PAGE_SIZE) return records;

    const seen = new Set(records.map(recordKey));
    let page = 1;
    while (records.length < MAX_RECORDS) {
      const data = await this.getJson(path, { page: String(page), perPage: String(PAGE_SIZE) });
      if (!Array.isArray(data)) throw new Error('Unexpected Ninox records response');
      let added = 0;
      for (const record of data as NinoxRecordLike[]) {
        const key = recordKey(record);
        if (seen.has(key)) continue;
        seen.add(key);
        records.push(record);
        added += 1;
        if (records.length >= MAX_RECORDS) break;
      }
      if (data.length < PAGE_SIZE || added === 0) break;
      page += 1;
    }
    return records;
  }

  private recordsPath(tableId: string): string {
    const { teamId, databaseId } = this.config;
    return `/teams/${segment(teamId)}/databases/${segment(databaseId)}/tables/${segment(tableId)}/records`;
  }

  private async getJson(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(path, `${this.config.baseUrl}/`);
    if (params) {
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 20_000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ninox GET failed with HTTP ${response.status}`);
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

function recordKey(record: NinoxRecordLike): string {
  return record.id === undefined ? JSON.stringify(record) : `${typeof record.id}:${String(record.id)}`;
}
