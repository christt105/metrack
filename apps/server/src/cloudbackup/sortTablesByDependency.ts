/**
 * Orders tables so each comes after the tables it references. `dependencies` maps a table to the tables its foreign
 * keys point at. Tables in a cycle, and self-references, keep their original order.
 */
export function sortTablesByDependency(
  names: string[],
  dependencies: Map<string, Set<string>>,
): string[] {
  const remaining = [...names];
  const done = new Set<string>();
  const sorted: string[] = [];
  while (remaining.length > 0) {
    const ready = remaining.findIndex((name) =>
      [...(dependencies.get(name) ?? [])].every(
        (parent) => parent === name || done.has(parent) || !names.includes(parent),
      ),
    );
    const [next] = remaining.splice(ready === -1 ? 0 : ready, 1);
    sorted.push(next!);
    done.add(next!);
  }
  return sorted;
}
