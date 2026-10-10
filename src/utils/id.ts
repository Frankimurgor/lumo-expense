// src/utils/id.ts
// Stable, collision-resistant ids without pulling in a uuid dependency.
// Format: <timestamp-base36>-<random-base36>  → sortable by creation time.

export function makeId(prefix = ''): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const id = `${time}-${rand}`;
  return prefix ? `${prefix}_${id}` : id;
}