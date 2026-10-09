import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { INVOICE_FILE_MAX_BYTES, INVOICE_FILE_TYPES } from '@ltl-shop/shared';
import { readSupabaseAdminConfig, type SupabaseAdminConfig } from '../auth/supabase-admin';

export const INVOICE_BUCKET = 'invoices';
/** A link to open an invoice lasts 5 minutes. */
export const INVOICE_LINK_SECONDS = 300;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * LTR-200 / D32 (PC-2): invoice files in Supabase Storage, in a **private** bucket. The browser uploads straight to
 * a signed URL (no file goes through the API or Vercel's body limit) and opens a file with a 5-minute signed link.
 * The bucket is created on first use with the same type and size rules the API checks (PDF, JPG, PNG, HEIC; 10 MB).
 * Without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (local, flow tests) files are off: `FILES_NOT_CONFIGURED`.
 */
@Injectable()
export class InvoiceFiles {
  private readonly logger = new Logger(InvoiceFiles.name);
  private readonly config: SupabaseAdminConfig | null;
  private readonly fetchImpl: FetchLike;
  private bucketReady = false;

  constructor(config?: SupabaseAdminConfig | null, fetchImpl?: FetchLike) {
    this.config = config === undefined ? readSupabaseAdminConfig() : config;
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  isConfigured() {
    return this.config !== null;
  }

  /** An absolute URL the browser PUTs the file to. */
  async uploadUrl(objectPath: string): Promise<string> {
    const config = this.requireConfig();
    await this.ensureBucket();
    const body = await this.call('POST', `/storage/v1/object/upload/sign/${INVOICE_BUCKET}/${objectPath}`, {});
    if (typeof body?.url !== 'string') throw new ServiceUnavailableException({ code: 'FILES_UNAVAILABLE', message: 'Could not prepare the upload. Try again.' });
    return `${config.url}/storage/v1${body.url}`;
  }

  /** An absolute URL that opens the file for 5 minutes. */
  async downloadUrl(objectPath: string, fileName: string): Promise<string> {
    const config = this.requireConfig();
    const body = await this.call('POST', `/storage/v1/object/sign/${INVOICE_BUCKET}/${objectPath}`, { expiresIn: INVOICE_LINK_SECONDS });
    const signed = typeof body?.signedURL === 'string' ? body.signedURL : typeof body?.signedUrl === 'string' ? body.signedUrl : null;
    if (!signed) throw new ServiceUnavailableException({ code: 'FILES_UNAVAILABLE', message: 'Could not open the file. Try again.' });
    const separator = signed.includes('?') ? '&' : '?';
    return `${config.url}/storage/v1${signed}${separator}download=${encodeURIComponent(fileName)}`;
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    const existing = await this.fetchImpl(`${this.config!.url}/storage/v1/bucket/${INVOICE_BUCKET}`, { headers: this.headers() });
    if (!existing.ok) {
      this.logger.log(`Creating the private "${INVOICE_BUCKET}" bucket`);
      await this.call('POST', '/storage/v1/bucket', {
        id: INVOICE_BUCKET,
        name: INVOICE_BUCKET,
        public: false,
        file_size_limit: INVOICE_FILE_MAX_BYTES,
        allowed_mime_types: [...INVOICE_FILE_TYPES],
      }, [409]);
    }
    this.bucketReady = true;
  }

  private requireConfig() {
    if (!this.config) {
      throw new ServiceUnavailableException({ code: 'FILES_NOT_CONFIGURED', message: 'Invoice files are not set up in this environment.' });
    }
    return this.config;
  }

  private headers() {
    return { authorization: `Bearer ${this.config!.serviceRoleKey}`, apikey: this.config!.serviceRoleKey, 'content-type': 'application/json' };
  }

  private async call(method: string, path: string, body: unknown, okStatuses: number[] = []) {
    const response = await this.fetchImpl(`${this.config!.url}${path}`, { method, headers: this.headers(), body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok && !okStatuses.includes(response.status)) {
      this.logger.warn(`Storage ${method} ${path} → ${response.status}: ${text.slice(0, 200)}`);
      throw new ServiceUnavailableException({ code: 'FILES_UNAVAILABLE', message: 'The file service did not answer. Try again.' });
    }
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
}
