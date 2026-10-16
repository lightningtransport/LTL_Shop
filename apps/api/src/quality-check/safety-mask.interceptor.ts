import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { from, type Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { hasCapability } from '../auth/capabilities';
import { PrismaService } from '../prisma/prisma.service';

/**
 * D46 / SQ-1 (LTR-230): the Shop never sees which Safety person did a Quality Check — only Safety does. Every
 * response of the controllers that use this interceptor goes out with each Safety person replaced by
 * `{ id: 'safety', name: 'Safety' }` (and their ids in `…Id` fields by `'safety'`), unless the viewer is Safety.
 * The data is masked in the API, so it never reaches the Shop's browser. People and Setup, where the Manager
 * manages the Safety accounts and teams, skip it (`@ShowSafetyPeople()`).
 */
export const SAFETY_MASKED = { id: 'safety', name: 'Safety' } as const;
const SHOW_SAFETY_PEOPLE = 'showSafetyPeople';
export const ShowSafetyPeople = () => SetMetadata(SHOW_SAFETY_PEOPLE, true);

const CACHE_MS = 30_000;

export type SafetyPeople = { ids: Set<string>; names: Set<string> };

/**
 * Replaces the Safety people found anywhere in a plain JSON-like value: `{ id, name }` objects, their ids in `…Id`
 * fields, and their names in `…By` / `…Name` / `name` / `user` text fields ("reportedBy": "Ana").
 */
export function maskSafetyPeople<T>(value: T, people: SafetyPeople): T {
  if (!people.ids.size) return value;
  const safetyIds = people.ids;
  const walk = (node: unknown, key?: string): unknown => {
    if (typeof node === 'string') {
      if (key && /Id$/.test(key) && safetyIds.has(node)) return SAFETY_MASKED.id;
      if (key && /(By|Name|^name|^user|^mechanics?)$/.test(key) && people.names.has(node)) return SAFETY_MASKED.name;
      return node;
    }
    if (!node || typeof node !== 'object' || node instanceof Date) return node;
    if (Array.isArray(node)) return node.map((item) => walk(item, key));
    const record = node as Record<string, unknown>;
    if (typeof record.id === 'string' && safetyIds.has(record.id) && typeof record.name === 'string') {
      // A person: keep only what the screens read, as "Safety".
      const masked: Record<string, unknown> = { ...SAFETY_MASKED };
      for (const [field, inner] of Object.entries(record)) if (!(field in masked) && field !== 'email' && field !== 'phone') masked[field] = walk(inner, field);
      return masked;
    }
    const out: Record<string, unknown> = {};
    for (const [field, inner] of Object.entries(record)) out[field] = walk(inner, field);
    return out;
  };
  return walk(value) as T;
}

@Injectable()
export class SafetyMaskInterceptor implements NestInterceptor {
  private cached: { people: SafetyPeople; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const viewer = context.switchToHttp().getRequest<Request>().user;
    const show = this.reflector.getAllAndOverride<boolean>(SHOW_SAFETY_PEOPLE, [context.getHandler(), context.getClass()]);
    if (show || (viewer && hasCapability(viewer, AppCapability.QUALITY_CHECK_PERFORM))) return next.handle();
    return next.handle().pipe(mergeMap((body) => from(this.safetyPeople().then((people) => maskSafetyPeople(body, people)))));
  }

  private async safetyPeople(): Promise<SafetyPeople> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.people;
    const rows = await this.prisma.userCapability.findMany({ where: { capability: 'QUALITY_CHECK_PERFORM' }, select: { user: { select: { id: true, name: true } } } });
    const people = { ids: new Set(rows.map((row) => row.user.id)), names: new Set(rows.map((row) => row.user.name)) };
    this.cached = { people, at: Date.now() };
    return people;
  }
}
