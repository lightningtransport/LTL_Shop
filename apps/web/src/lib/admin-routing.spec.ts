import { describe, expect, it } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import { postLoginPath } from './admin-routing';
import { getAdminMessages } from './admin-messages';

describe('Shop Admin routing and messages', () => {
  const admin = { capabilities: [AppCapability.ADMIN_ACCESS] };
  const standard = { capabilities: [AppCapability.MECHANIC_STANDARD] };
  const pm = { capabilities: [AppCapability.MECHANIC_PM] };

  it('routes Admin-capable users to the requested Admin destination', () => {
    expect(postLoginPath(admin, '/admin')).toBe('/admin');
    expect(postLoginPath(admin, '/admin/work-orders?status=open')).toBe(
      '/admin/work-orders?status=open',
    );
  });

  it('routes each mechanic capability to its explicit workspace', () => {
    expect(postLoginPath(standard, '/admin')).toBe('/mechanic/standard');
    expect(postLoginPath(pm)).toBe('/mechanic/pm');
  });

  it('does not accept an external redirect target', () => {
    expect(postLoginPath(admin, '//example.com/admin')).toBe('/admin');
  });

  it('keeps multi-workspace users landing in Admin', () => {
    expect(postLoginPath({ capabilities: Object.values(AppCapability) })).toBe('/admin');
  });

  it('keeps one typed message shape for English and Spanish', () => {
    expect(Object.keys(getAdminMessages('en'))).toEqual(Object.keys(getAdminMessages('es')));
    expect(getAdminMessages('es').nextPhaseBody).toContain('Work Orders');
    expect(getAdminMessages('es').nextPhaseBody).toContain('unidades');
    expect(getAdminMessages('en').lastReportedLocation).toBe('Last reported location');
    expect(getAdminMessages('es').lastReportedLocation).toBe('Ubicación reportada');
    expect(getAdminMessages('en').locationUpdatedOn).toBe('Last reported on');
    expect(getAdminMessages('es').locationUpdatedOn).toBe('Reportada el');
    expect(getAdminMessages('en').lastReportedLocation.toLowerCase()).not.toContain('in yard');
    expect(getAdminMessages('es').lastReportedLocation.toLowerCase()).not.toContain('en el yard');
    expect(getAdminMessages('en').locationUpdatedOn.toLowerCase()).not.toContain('in yard');
    expect(getAdminMessages('es').locationUpdatedOn.toLowerCase()).not.toContain('en el yard');
    expect(getAdminMessages('en').lastReportedLocation.toLowerCase()).not.toContain('presence');
    expect(getAdminMessages('es').lastReportedLocation.toLowerCase()).not.toContain('presencia');
  });
});
