import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { SupabaseAdminClient, SupabaseAdminError } from './supabase-admin';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabaseAdmin: SupabaseAdminClient) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    return { user: req.user };
  }

  /**
   * D22: after the person changes the temporary password, the web calls this so the
   * `must_change_password` flag in `app_metadata` (service role only) stops forcing the sheet.
   * Any active Shop user may call it for their own account; it never fails the password change.
   */
  @Post('password-changed')
  @UseGuards(AuthGuard)
  async passwordChanged(@Req() req: Request): Promise<{ cleared: boolean }> {
    const authId = req.user?.supabaseAuthId ?? null;
    if (!authId || !this.supabaseAdmin.isConfigured()) return { cleared: false };
    try {
      await this.supabaseAdmin.clearMustChangePassword(authId);
      return { cleared: true };
    } catch (error) {
      if (error instanceof SupabaseAdminError) return { cleared: false };
      throw error;
    }
  }
}
