import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';
import { UserRole } from '@ltl-shop/shared';
import type { AppCapability } from '@ltl-shop/shared';
import { toSharedCapability } from './capabilities';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: `${UserRole}`;
  active: boolean;
  capabilities: AppCapability[];
  supabaseAuthId: string | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }
    const token = header.slice('Bearer '.length);

    // Dev bypass for local/demo without Supabase
    if (process.env.AUTH_DEV_BYPASS === 'true' && token.startsWith('dev:')) {
      const email = token.slice(4);
      const user = await this.resolveShopUser(email, null);
      req.user = user;
      return true;
    }

    let payload;
    try {
      payload = await this.verifySupabaseJwt(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired authorization token');
    }
    const email = String(payload.email ?? '');
    if (!email) {
      throw new UnauthorizedException('Token missing email');
    }
    const sub = String(payload.sub ?? '');
    const user = await this.resolveShopUser(email, sub || null);
    req.user = user;
    return true;
  }

  private async verifySupabaseJwt(token: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    // Prefer JWKS — Supabase signing keys use ES256/RS256.
    if (supabaseUrl) {
      try {
        if (!this.jwks) {
          this.jwks = createRemoteJWKSet(
            new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
          );
        }
        const { payload } = await jwtVerify(token, this.jwks);
        return payload;
      } catch {
        // Fall through to legacy HS256 verification.
      }
    }

    if (jwtSecret) {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(jwtSecret),
        { algorithms: ['HS256'] },
      );
      return payload;
    }

    throw new UnauthorizedException('Auth is not configured');
  }

  private async resolveShopUser(
    email: string,
    supabaseAuthId: string | null,
  ): Promise<AuthUser> {
    let user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { capabilities: { select: { capability: true } } },
    });

    if (!user && supabaseAuthId) {
      user = await this.prisma.user.findUnique({
        where: { supabaseAuthId },
        include: { capabilities: { select: { capability: true } } },
      });
    }

    if (!user || !user.active) {
      throw new ForbiddenException(
        'Your account is not configured for the Shop application.',
      );
    }

    if (supabaseAuthId && user.supabaseAuthId !== supabaseAuthId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { supabaseAuthId },
        include: { capabilities: { select: { capability: true } } },
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      capabilities: user.capabilities.map(({ capability }) => toSharedCapability(capability)),
      supabaseAuthId: user.supabaseAuthId,
    };
  }
}
