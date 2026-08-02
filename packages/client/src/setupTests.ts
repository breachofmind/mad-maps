import '@testing-library/jest-dom';

// jsdom doesn't provide these, but react-dom/server requires a working
// TextEncoder/TextDecoder at module load time — needed by any test that
// imports code using renderToStaticMarkup. Pulled off Node's real `util`
// through a *direct* `eval('require')` (rather than a static `import` or
// bare `require`) since this package's tsconfig deliberately excludes
// @types/node (it's a browser-only client), so neither `util`'s module
// declarations nor a `require` ambient exist here to type-check against.
// Must stay a direct eval (not `(0, eval)(...)`) — indirect eval runs in
// global scope and can't see the CommonJS module's local `require` param.
if (typeof globalThis.TextEncoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
  // eslint-disable-next-line no-eval
  const nodeRequire: (id: string) => { TextEncoder: typeof TextEncoder; TextDecoder: typeof TextDecoder } =
    eval('require');
  const nodeUtil = nodeRequire('util');
  globalThis.TextEncoder ??= nodeUtil.TextEncoder;
  globalThis.TextDecoder ??= nodeUtil.TextDecoder;
}
