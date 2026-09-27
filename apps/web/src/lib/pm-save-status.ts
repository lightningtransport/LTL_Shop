export type PmSaveStatus = 'saving' | 'saved' | 'error' | null;

/**
 * LTR-151 (§8.11): "Saved" confirms a write this visit made. Opening the PM service, or a draft that
 * was never sent, shows nothing.
 */
export function pmSaveStatus(state: { saving: boolean; dirty: boolean; saveError: string | null; savedOnce: boolean }): PmSaveStatus {
  if (state.saving) return 'saving';
  if (state.saveError) return 'error';
  if (!state.dirty && state.savedOnce) return 'saved';
  return null;
}
