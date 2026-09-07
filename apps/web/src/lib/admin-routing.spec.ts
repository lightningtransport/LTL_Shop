import { describe, expect, it } from 'vitest';
import { UserRole } from '@ltl-shop/shared';
import { postLoginPath } from './admin-routing';
import { getAdminMessages } from './admin-messages';

describe('Shop Admin routing and messages', () => {
  it('routes managers and admins to the requested Admin destination', () => {
    expect(postLoginPath(UserRole.MANAGER, '/admin')).toBe('/admin');
    expect(postLoginPath(UserRole.ADMIN, '/admin/work-orders?status=open')).toBe(
      '/admin/work-orders?status=open',
    );
  });

  it('keeps mechanics in the existing mechanic application', () => {
    expect(postLoginPath(UserRole.MECHANIC, '/admin')).toBe('/');
  });

  it('does not accept an external redirect target', () => {
    expect(postLoginPath(UserRole.MANAGER, '//example.com/admin')).toBe('/admin');
  });

  it('keeps one typed message shape for English and Spanish', () => {
    expect(Object.keys(getAdminMessages('en'))).toEqual(Object.keys(getAdminMessages('es')));
    expect(getAdminMessages('es').nextPhaseBody).toContain('Work Orders');
    expect(getAdminMessages('es').nextPhaseBody).toContain('Trucks');
  });
});
