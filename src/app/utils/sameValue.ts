function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The keys of `record` that hold a value: a key set to undefined is as good as missing, as in JSON. */
function definedKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter((key) => record[key] !== undefined);
}

/** Whether two values are the same data: primitives, arrays and plain objects, compared in depth. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = definedKeys(a);
  return keys.length === definedKeys(b).length && keys.every((key) => sameValue(a[key], b[key]));
}
