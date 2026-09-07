import { describe, expect, it, vi } from 'vitest';
import { TrucksService } from './trucks.service';

const truck = (truckNumber: string) => ({
  id: `truck-${truckNumber}`,
  truckNumber,
  make: null,
  model: null,
  year: null,
  mileage: null,
  company: null,
  owner: null,
});

describe('TrucksService search', () => {
  it('returns exact and prefix matches before internal matches in natural order', async () => {
    const findMany = vi.fn().mockResolvedValueOnce([
      truck('905'), truck('901'), truck('90'),
    ]);
    const service = new TrucksService({ truck: { findMany } } as never);

    await expect(service.search(' # 9 ')).resolves.toMatchObject([
      { truckNumber: '90' },
      { truckNumber: '901' },
      { truckNumber: '905' },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    }));
  });

  it('uses contains matches only when no truck begins with the search', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([truck('905'), truck('609'), truck('899')]);
    const service = new TrucksService({ truck: { findMany } } as never);

    await expect(service.search('05')).resolves.toMatchObject([
      { truckNumber: '609' },
      { truckNumber: '899' },
      { truckNumber: '905' },
    ]);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: { truckNumber: { contains: '05', mode: 'insensitive' } },
    }));
  });
});
