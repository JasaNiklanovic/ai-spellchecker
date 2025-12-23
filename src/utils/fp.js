// Functional programming utilities
// Pure functions, composition, and immutable patterns

// Function composition (right to left)
export const compose = (...fns) => (x) =>
  fns.reduceRight((acc, fn) => fn(acc), x);

// Function composition (left to right) - more readable for pipelines
export const pipe = (...fns) => (x) =>
  fns.reduce((acc, fn) => fn(acc), x);

// Async pipe for promise chains
export const pipeAsync = (...fns) => (x) =>
  fns.reduce(async (acc, fn) => fn(await acc), Promise.resolve(x));

// Curry a function
export const curry = (fn) => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

// Map over object values (immutable)
export const mapValues = curry((fn, obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(v)])
  )
);

// Filter object entries (immutable)
export const filterEntries = curry((predicate, obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => predicate(k, v))
  )
);

// Safe property access
export const prop = curry((key, obj) => obj?.[key]);

// Safe deep property access
export const path = curry((keys, obj) =>
  keys.reduce((acc, key) => acc?.[key], obj)
);

// Partition array into [matches, nonMatches]
export const partition = curry((predicate, arr) =>
  arr.reduce(
    ([pass, fail], item) =>
      predicate(item) ? [[...pass, item], fail] : [pass, [...fail, item]],
    [[], []]
  )
);

// Group array items by key function
export const groupBy = curry((keyFn, arr) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    return { ...acc, [key]: [...(acc[key] || []), item] };
  }, {})
);

// Memoize a function
export const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// Debounce (useful for real-time spell checking)
export const debounce = curry((delay, fn) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(fn(...args)), delay);
    });
  };
});

// Create a result type for error handling without exceptions
export const Result = {
  ok: (value) => ({ ok: true, value }),
  err: (error) => ({ ok: false, error }),
  map: curry((fn, result) =>
    result.ok ? Result.ok(fn(result.value)) : result
  ),
  flatMap: curry((fn, result) =>
    result.ok ? fn(result.value) : result
  ),
  unwrapOr: curry((defaultValue, result) =>
    result.ok ? result.value : defaultValue
  ),
};

// Flatten array one level
export const flatten = (arr) => arr.flat(1);

// Unique values
export const unique = (arr) => [...new Set(arr)];

// Sort by key (immutable)
export const sortBy = curry((keyFn, arr) =>
  [...arr].sort((a, b) => {
    const aKey = keyFn(a);
    const bKey = keyFn(b);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  })
);
