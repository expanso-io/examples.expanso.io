import { isDeepStrictEqual } from 'node:util';

export function checkpointLines(
  value,
  comparison = value,
  missingType = 'added'
) {
  const lines = [];
  function visit(current, before, present, indent, key, comma) {
    const array = Array.isArray(current);
    const object = current !== null && typeof current === 'object';
    const sameContainer =
      object &&
      before !== null &&
      typeof before === 'object' &&
      Array.isArray(before) === array;
    const type = !present
      ? missingType
      : (object ? !sameContainer : !isDeepStrictEqual(current, before))
        ? 'highlighted'
        : 'normal';
    const prefix = key === undefined ? '' : `${JSON.stringify(key)}: `;
    const entries = object ? Object.entries(current) : [];
    const metadata = {
      indent,
      ...(key === undefined ? {} : { key }),
      valueType: current === null ? 'null' : array ? 'array' : typeof current,
      type,
    };
    if (!entries.length) {
      lines.push({
        content: prefix + JSON.stringify(current) + comma,
        ...metadata,
      });
      return;
    }
    lines.push({ content: prefix + (array ? '[' : '{'), ...metadata });
    entries.forEach(([childKey, child], index) => {
      const exists = sameContainer && Object.hasOwn(before, childKey);
      visit(
        child,
        exists ? before[childKey] : undefined,
        exists,
        indent + 1,
        array ? undefined : childKey,
        index < entries.length - 1 ? ',' : ''
      );
    });
    lines.push({ content: (array ? ']' : '}') + comma, indent });
  }
  visit(value, comparison, true, 0, undefined, '');
  return lines;
}
