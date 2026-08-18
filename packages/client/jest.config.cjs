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
    // isolatedModules skips full program-wide type-checking during
    // transform (ts-jest falls back to per-file transpileModule) — types
    // are already verified separately by `npm run typecheck`, so paying
    // for a full TS program in every parallel worker here just adds CPU/
    // memory contention, which is what was making real-timer/userEvent-
    // heavy tests (AddExternalLayerDialog, IconPicker) intermittently blow
    // through Jest's default per-test timeout under load.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', isolatedModules: true }],
    '\\.svg$': '<rootDir>/jest/rawSvgTransform.cjs',
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // Default 5000ms is tight for jsdom + MUI + real userEvent interactions
  // (clicks/typing/act() flushes), especially under parallel-worker CPU
  // contention — give these headroom rather than relying on every worker
  // getting a quiet machine.
  testTimeout: 15000,
};
