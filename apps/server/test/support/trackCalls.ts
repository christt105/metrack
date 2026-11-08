function definingClass(target: object, property: string): string | undefined {
  for (let proto = Object.getPrototypeOf(target); proto && proto !== Object.prototype;) {
    if (Object.prototype.hasOwnProperty.call(proto, property)) return proto.constructor.name;
    proto = Object.getPrototypeOf(proto);
  }
  return undefined;
}

/** Wraps an object so the methods called on it are added to `called` as `Class.method`. */
export function trackCalls<T extends object>(target: T, called: Set<string>): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      const value: unknown = Reflect.get(object, property, receiver);
      if (typeof property === 'string' && typeof value === 'function') {
        const owner = definingClass(object, property);
        if (owner) called.add(`${owner}.${property}`);
      }
      return value;
    },
  });
}

/** Every method defined by the classes of the object, as `Class.method`. */
export function methodsOf(target: object): string[] {
  const names: string[] = [];
  for (let proto = Object.getPrototypeOf(target); proto && proto !== Object.prototype;) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor') names.push(`${proto.constructor.name}.${name}`);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return names;
}
