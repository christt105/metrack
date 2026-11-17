/** A tracking change to save at once, with the restore patch that puts the previous snapshot back. */
export interface QuickChange {
  patch: Record<string, unknown>;
  undo: Record<string, unknown>;
}
