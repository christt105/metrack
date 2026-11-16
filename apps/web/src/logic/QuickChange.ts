/** A tracking change to save at once, with the patch that reverts it when the old state allows one. */
export interface QuickChange {
  patch: Record<string, unknown>;
  undo: Record<string, unknown> | null;
}
