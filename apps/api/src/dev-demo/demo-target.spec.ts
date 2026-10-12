import { describe, expect, it } from 'vitest';
import { PRODUCTION_SUPABASE_REF, demoDatabaseRefusal } from './demo-target';

const DEMO_REF = 'abcdefghijklmnopqrst';

describe('demoDatabaseRefusal (D36, D39)', () => {
  it('lets the local demo database through, and no other local one', () => {
    expect(demoDatabaseRefusal('postgresql://postgres:postgres@localhost:5432/ltl_shop_demo')).toBeNull();
    expect(demoDatabaseRefusal('postgresql://postgres:postgres@127.0.0.1:5432/ltl_shop_test')).toMatch(/Refusing/);
  });

  it('lets the published demo project through only by its ref', () => {
    const direct = `postgresql://postgres:pw@db.${DEMO_REF}.supabase.co:5432/postgres`;
    const pooler = `postgresql://postgres.${DEMO_REF}:pw@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;
    expect(demoDatabaseRefusal(direct, {})).toMatch(/Refusing/);
    expect(demoDatabaseRefusal(direct, { DEMO_SUPABASE_REF: DEMO_REF })).toBeNull();
    expect(demoDatabaseRefusal(pooler, { DEMO_SUPABASE_REF: DEMO_REF })).toBeNull();
    expect(demoDatabaseRefusal(pooler, { DEMO_SUPABASE_REF: 'abc' })).toMatch(/Refusing/);
  });

  it('never touches production, whatever is set', () => {
    const production = `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:pw@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
    expect(demoDatabaseRefusal(production, { DEMO_SUPABASE_REF: PRODUCTION_SUPABASE_REF })).toBe('Refusing: that is the production database.');
    expect(demoDatabaseRefusal(`postgresql://u:p@localhost:5432/demo_${PRODUCTION_SUPABASE_REF}`)).toBe('Refusing: that is the production database.');
  });
});
