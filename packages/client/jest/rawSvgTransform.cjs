// Mirrors Vite's `?raw` import (used by MenuBar.tsx to inline the logo SVG)
// for Jest, which has no native concept of query-suffixed imports: the
// moduleNameMapper in jest.config.cjs strips "?raw" so Jest resolves the
// real .svg file, then this transform turns its contents into the same
// plain-string default export Vite would produce.
module.exports = {
  process(sourceText) {
    return { code: `module.exports = ${JSON.stringify(sourceText)};` };
  },
};
