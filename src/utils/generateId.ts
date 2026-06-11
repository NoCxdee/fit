/* ================================================================
   Fit — Utility: Generate unique IDs
   ================================================================ */

let counter = 0;

export function generateId(prefix = 'id'): string {
  counter++;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
