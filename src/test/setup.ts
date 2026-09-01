import '@testing-library/jest-dom/vitest';

// Node 26 exposes an experimental global `localStorage` getter that returns
// undefined without a CLI storage file. Use an isolated standards-compatible
// store so the supported `node >=22` range behaves consistently in tests.
const storedValues = new Map<string, string>();
const testLocalStorage: Storage = {
  get length() { return storedValues.size; },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(String(key)) ?? null,
  key: (index) => [...storedValues.keys()][index] ?? null,
  removeItem: (key) => { storedValues.delete(String(key)); },
  setItem: (key, value) => { storedValues.set(String(key), String(value)); },
};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: testLocalStorage,
});
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: testLocalStorage,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => undefined,
});
