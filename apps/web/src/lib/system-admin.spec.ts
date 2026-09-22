import { UserRole } from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { adminWriteFailureMessage, canShowAdminWrites, isRosterEmail, isSystemAdmin } from './system-admin';

describe('isSystemAdmin', () => {
  it('allows only the admin role', () => {
    expect(isSystemAdmin({ role: UserRole.ADMIN })).toBe(true);
    expect(isSystemAdmin({ role: UserRole.MANAGER })).toBe(false);
    expect(isSystemAdmin({ role: UserRole.MECHANIC })).toBe(false);
    expect(isSystemAdmin(null)).toBe(false);
    expect(isSystemAdmin(undefined)).toBe(false);
  });
});

describe('canShowAdminWrites', () => {
  it('shows writes for a System Admin session even before the client profile loads', () => {
    expect(canShowAdminWrites(UserRole.ADMIN, null)).toBe(true);
    expect(canShowAdminWrites(UserRole.ADMIN, undefined)).toBe(true);
    expect(canShowAdminWrites(UserRole.ADMIN, { role: UserRole.MANAGER })).toBe(true);
  });

  it('keeps Shop Manager read-only, including when only admin.access would be present', () => {
    expect(canShowAdminWrites(UserRole.MANAGER, null)).toBe(false);
    expect(canShowAdminWrites(UserRole.MANAGER, { role: UserRole.MANAGER })).toBe(false);
    expect(canShowAdminWrites(undefined, { role: UserRole.MANAGER })).toBe(false);
    expect(canShowAdminWrites('manager', { role: UserRole.MECHANIC })).toBe(false);
  });

  it('accepts a loaded client profile with role admin when the session role is missing', () => {
    expect(canShowAdminWrites(undefined, { role: UserRole.ADMIN })).toBe(true);
    expect(canShowAdminWrites('manager', { role: UserRole.ADMIN })).toBe(true);
  });
});

describe('isRosterEmail', () => {
  it('accepts a normal email and rejects blanks', () => {
    expect(isRosterEmail('  ana@shop.example  ')).toBe(true);
    expect(isRosterEmail('ana')).toBe(false);
    expect(isRosterEmail('ana@shop')).toBe(false);
    expect(isRosterEmail('')).toBe(false);
  });
});

describe('adminWriteFailureMessage', () => {
  const copy = { forbidden: 'forbidden', conflict: 'conflict', failed: 'failed' };

  it('maps 403 and 409 to the locked copy', () => {
    expect(adminWriteFailureMessage(new ApiError('nope', 403, null), copy)).toBe('forbidden');
    expect(adminWriteFailureMessage(new ApiError('dup', 409, null), copy)).toBe('conflict');
  });

  it('keeps a 400 message and falls back otherwise', () => {
    expect(adminWriteFailureMessage(new ApiError('Enter a Job name.', 400, null), copy)).toBe('Enter a Job name.');
    expect(adminWriteFailureMessage(new Error('boom'), copy)).toBe('failed');
  });
});
