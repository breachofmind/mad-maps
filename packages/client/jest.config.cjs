/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  // Vite's `?raw` import (MenuBar.tsx's inlined logo SVG) has no Jest
  // equivalent — strip the suffix so Jest resolves the real .svg file, then
  // run it through rawSvgTransform.cjs to produce the same string export.
  moduleNameMapper: {
    '^(.*)\\.svg\\?raw$': '$1.svg',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
    '\\.svg$': '<rootDir>/jest/rawSvgTransform.cjs',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
};
