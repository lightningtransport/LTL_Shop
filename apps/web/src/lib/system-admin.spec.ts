import { AppCapability, UserRole } from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages';
import { ApiError } from './api';
import {
  adminWriteFailureMessage, canShowAdminWrites, canShowRosterWrites, isRosterEmail, isSystemAdmin, mechanicOpenWorkFromError,
} from './system-admin';

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

describe('canShowRosterWrites (D22)', () => {
  const managerCaps = [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE, AppCapability.YARD_OPERATIONS_MANAGE];

  it('opens the roster to the Shop Manager, by session role before the profile loads and by capabilities after', () => {
    expect(canShowRosterWrites(UserRole.MANAGER, null)).toBe(true);
    expect(canShowRosterWrites(UserRole.MANAGER, { role: UserRole.MANAGER, capabilities: managerCaps })).toBe(true);
    expect(canShowRosterWrites(undefined, { role: UserRole.MANAGER, capabilities: managerCaps })).toBe(true);
  });

  it('keeps the System Admin by role and refuses everyone else', () => {
    expect(canShowRosterWrites(UserRole.ADMIN, null)).toBe(true);
    expect(canShowRosterWrites('manager', { role: UserRole.ADMIN, capabilities: [AppCapability.ADMIN_ACCESS] })).toBe(true);
    expect(canShowRosterWrites(UserRole.MANAGER, { role: UserRole.MANAGER, capabilities: [AppCapability.ADMIN_ACCESS] })).toBe(false);
    expect(canShowRosterWrites(UserRole.MECHANIC, { role: UserRole.MECHANIC, capabilities: [AppCapability.QUALITY_CHECK_PERFORM] })).toBe(false);
    expect(canShowRosterWrites(undefined, null)).toBe(false);
  });

  it('does not open catalog writes to the Manager', () => {
    expect(canShowAdminWrites(UserRole.MANAGER, { role: UserRole.MANAGER })).toBe(false);
  });
});

describe('mechanicOpenWorkFromError (D22)', () => {
  it('reads the pending Jobs and running clock from a MECHANIC_HAS_OPEN_WORK 409', () => {
    const body = {
      code: 'MECHANIC_HAS_OPEN_WORK',
      message: 'Reassign first.',
      pendingJobs: [{ workOrderId: 'wo-1', workOrderDisplayId: 'WO-0001', truckNumber: '905', jobDisplayName: 'Brake pads' }, { bogus: true }],
      runningSession: true,
    };
    expect(mechanicOpenWorkFromError(new ApiError('Reassign first.', 409, body))).toEqual({
      pendingJobs: [{ workOrderId: 'wo-1', workOrderDisplayId: 'WO-0001', truckNumber: '905', jobDisplayName: 'Brake pads' }],
      runningSession: true,
    });
  });

  it('ignores other errors', () => {
    expect(mechanicOpenWorkFromError(new ApiError('dup', 409, { code: 'MECHANIC_EMAIL_EXISTS' }))).toBeNull();
    expect(mechanicOpenWorkFromError(new Error('boom'))).toBeNull();
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

  it('maps the coded 409s and 5xx of the roster (D22) through the catalog, keeping the email conflict on its copy', () => {
    const es = { ...copy, locale: getAdminMessages('es').locale, apiError: getAdminMessages('es').apiError };
    expect(adminWriteFailureMessage(new ApiError('missing', 409, { code: 'AUTH_ACCOUNT_MISSING', message: 'missing' }), es)).toBe(getAdminMessages('es').apiError.AUTH_ACCOUNT_MISSING);
    expect(adminWriteFailureMessage(new ApiError('open', 409, { code: 'MECHANIC_HAS_OPEN_WORK', message: 'open' }), es)).toBe(getAdminMessages('es').apiError.MECHANIC_HAS_OPEN_WORK);
    expect(adminWriteFailureMessage(new ApiError('dup', 409, { code: 'MECHANIC_EMAIL_EXISTS', message: 'dup' }), es)).toBe('conflict');
    expect(adminWriteFailureMessage(new ApiError('auth', 502, { code: 'AUTH_ACCOUNT_CREATE_FAILED', message: 'auth' }), es)).toBe(getAdminMessages('es').apiError.AUTH_ACCOUNT_CREATE_FAILED);
    expect(adminWriteFailureMessage(new ApiError('auth', 503, { code: 'AUTH_NOT_CONFIGURED', message: 'auth' }), es)).toBe(getAdminMessages('es').apiError.AUTH_NOT_CONFIGURED);
    expect(adminWriteFailureMessage(new ApiError('boom', 502, null), es)).toBe('failed');
  });

  it('localizes a 400 through the catalog: known codes map, unmapped text stays raw only in English (LTR-181)', () => {
    const es = { ...copy, locale: getAdminMessages('es').locale, apiError: getAdminMessages('es').apiError };
    const en = { ...copy, locale: getAdminMessages('en').locale, apiError: getAdminMessages('en').apiError };
    const codedFailure = new ApiError('That alias exists', 400, { code: 'CATALOG_ALIAS_EXISTS', message: 'That alias exists' });
    expect(adminWriteFailureMessage(codedFailure, es)).toBe(getAdminMessages('es').apiError.CATALOG_ALIAS_EXISTS);
    expect(adminWriteFailureMessage(new ApiError('Enter a Job name.', 400, null), es)).toBe('failed');
    expect(adminWriteFailureMessage(new ApiError('Enter a Job name.', 400, null), en)).toBe('Enter a Job name.');
  });
});
