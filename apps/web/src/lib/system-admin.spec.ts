import { AppCapability, UserRole } from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import { ApiError } from './api';
import {
  adminWriteFailureMessage, canManagePerson, canShowManagerWrites, isRosterEmail, isSystemAdmin, mechanicOpenWorkFromError,
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

describe('canManagePerson (LTR-253 / D48)', () => {
  const managerCaps = [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE, AppCapability.YARD_OPERATIONS_MANAGE];
  const manager = { role: UserRole.MANAGER, capabilities: managerCaps };

  it('lets a Shop Manager act on shop floor staff only', () => {
    expect(canManagePerson(UserRole.MANAGER, manager, UserRole.MECHANIC)).toBe(true);
    expect(canManagePerson(UserRole.MANAGER, manager, UserRole.MANAGER)).toBe(false);
    expect(canManagePerson(UserRole.MANAGER, manager, UserRole.ADMIN)).toBe(false);
  });

  it('lets a System Admin act on everyone, and a mechanic on no one', () => {
    expect(canManagePerson(UserRole.ADMIN, { role: UserRole.ADMIN, capabilities: managerCaps }, UserRole.MANAGER)).toBe(true);
    expect(canManagePerson(UserRole.ADMIN, null, UserRole.ADMIN)).toBe(true);
    expect(canManagePerson(UserRole.MECHANIC, { role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD] }, UserRole.MECHANIC)).toBe(false);
  });

  it('shows the coded 403 sentence instead of the generic one', () => {
    const es = { ...getAdminMessages('es'), forbidden: 'generic', conflict: 'c', failed: 'f' };
    expect(adminWriteFailureMessage(new ApiError('no', 403, { code: 'STAFF_ADMIN_ONLY', message: 'no' }), es)).toBe(getAdminMessages('es').apiError.STAFF_ADMIN_ONLY);
    expect(adminWriteFailureMessage(new ApiError('no', 403, { message: 'no' }), es)).toBe('generic');
  });
});

describe('canShowManagerWrites (D22 roster, D25 catalog)', () => {
  const managerCaps = [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE, AppCapability.YARD_OPERATIONS_MANAGE];

  it('opens the roster and the Job catalog to the Shop Manager, by session role before the profile loads and by capabilities after', () => {
    expect(canShowManagerWrites(UserRole.MANAGER, null)).toBe(true);
    expect(canShowManagerWrites(UserRole.MANAGER, { role: UserRole.MANAGER, capabilities: managerCaps })).toBe(true);
    expect(canShowManagerWrites(undefined, { role: UserRole.MANAGER, capabilities: managerCaps })).toBe(true);
  });

  it('keeps the System Admin by role and refuses everyone else', () => {
    expect(canShowManagerWrites(UserRole.ADMIN, null)).toBe(true);
    expect(canShowManagerWrites(UserRole.ADMIN, undefined)).toBe(true);
    expect(canShowManagerWrites(undefined, { role: UserRole.ADMIN, capabilities: [AppCapability.ADMIN_ACCESS] })).toBe(true);
    expect(canShowManagerWrites('manager', { role: UserRole.ADMIN, capabilities: [AppCapability.ADMIN_ACCESS] })).toBe(true);
    expect(canShowManagerWrites(UserRole.MANAGER, { role: UserRole.MANAGER, capabilities: [AppCapability.ADMIN_ACCESS] })).toBe(false);
    expect(canShowManagerWrites(UserRole.MECHANIC, { role: UserRole.MECHANIC, capabilities: [AppCapability.QUALITY_CHECK_PERFORM] })).toBe(false);
    expect(canShowManagerWrites(undefined, null)).toBe(false);
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
