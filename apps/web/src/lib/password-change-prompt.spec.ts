import { describe, expect, it } from 'vitest';
import {
  policyRequiresPasswordChange,
  readPasswordChangeResolved,
  shouldOpenUpdatePasswordSheet,
  updatePasswordSheetCopy,
  writePasswordChangeResolved,
} from './password-change-prompt';

function jwt(payload: object) {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${body}.sig`;
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('policyRequiresPasswordChange', () => {
  const base = { user: { id: 'pm-1' }, accessToken: 'dev:pm@example.com', passwordRecovery: false };

  it('stays off when the session has no password-change policy', () => {
    expect(policyRequiresPasswordChange(base)).toBe(false);
    expect(policyRequiresPasswordChange({ ...base, user: { mustChangePassword: false } })).toBe(false);
    expect(policyRequiresPasswordChange({ ...base, user: { must_change_password: 'false' } })).toBe(false);
  });

  it('reads the shop profile flag and Supabase metadata', () => {
    expect(policyRequiresPasswordChange({ ...base, user: { mustChangePassword: true } })).toBe(true);
    expect(policyRequiresPasswordChange({ ...base, user: { must_change_password: '1' } })).toBe(true);
    expect(policyRequiresPasswordChange({
      ...base,
      user: { app_metadata: { password_change_required: true } },
    })).toBe(true);
  });

  it('reads the access-token claim and ignores the dev bypass token', () => {
    expect(policyRequiresPasswordChange({
      ...base,
      accessToken: jwt({ user_metadata: { mustChangePassword: true } }),
    })).toBe(true);
    expect(policyRequiresPasswordChange({ ...base, accessToken: 'dev:pm@example.com' })).toBe(false);
    expect(policyRequiresPasswordChange({ ...base, accessToken: 'not-a-jwt' })).toBe(false);
  });

  it('treats an in-progress password recovery as a required change', () => {
    expect(policyRequiresPasswordChange({ ...base, passwordRecovery: true })).toBe(true);
  });
});

describe('shouldOpenUpdatePasswordSheet', () => {
  it('opens only when policy requires a change and this session has not resolved it', () => {
    expect(shouldOpenUpdatePasswordSheet({
      policyRequiresPasswordChange: true,
      passwordChangeResolved: false,
    })).toBe(true);
    expect(shouldOpenUpdatePasswordSheet({
      policyRequiresPasswordChange: false,
      passwordChangeResolved: false,
    })).toBe(false);
    expect(shouldOpenUpdatePasswordSheet({
      policyRequiresPasswordChange: true,
      passwordChangeResolved: true,
    })).toBe(false);
  });
});

describe('password change session flag', () => {
  it('remembers a completed or dismissed prompt for the user and can clear it', () => {
    const storage = memoryStorage();
    expect(readPasswordChangeResolved('pm-1', storage)).toBe(false);
    writePasswordChangeResolved('pm-1', true, storage);
    expect(readPasswordChangeResolved('pm-1', storage)).toBe(true);
    expect(readPasswordChangeResolved('other', storage)).toBe(false);
    writePasswordChangeResolved('pm-1', false, storage);
    expect(readPasswordChangeResolved('pm-1', storage)).toBe(false);
  });
});

describe('updatePasswordSheetCopy', () => {
  it('names the sheet in English and Spanish', () => {
    expect(updatePasswordSheetCopy('en').title).toBe('Update password');
    expect(updatePasswordSheetCopy('en').dismiss).toBe('Not now');
    expect(updatePasswordSheetCopy('es').title).toBe('Actualizar contraseña');
    expect(updatePasswordSheetCopy('es').dismiss).toBe('Ahora no');
    expect(updatePasswordSheetCopy('es').description).toContain('política');
  });
});
