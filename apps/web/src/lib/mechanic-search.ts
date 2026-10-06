export type PickerMechanic = { id: string; name: string };

/** Stage 2: the mechanic picker search — case- and accent-insensitive ("garcia" finds "Manuel García"). */
export function filterPickerMechanics(mechanics: PickerMechanic[], query: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const needle = normalize(query);
  return needle ? mechanics.filter((mechanic) => normalize(mechanic.name).includes(needle)) : mechanics;
}
