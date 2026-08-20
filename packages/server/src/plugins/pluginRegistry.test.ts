import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPlugins, listPlugins, getPlugin } from './pluginRegistry';

function writeFixture(dir: string, filename: string, contents: string) {
  fs.writeFileSync(path.join(dir, filename), contents, 'utf-8');
}

describe('pluginRegistry', () => {
  let dir: string;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mad-maps-plugins-'));
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('loads a valid plugin, deriving its id from the filename', () => {
    writeFixture(
      dir,
      'weather-forecast.js',
      `module.exports = { name: 'Weather Forecast', description: 'A forecast', handler: async () => ({ blocks: [] }) };`,
    );

    loadPlugins(dir);

    expect(listPlugins()).toEqual([
      { id: 'weather-forecast', name: 'Weather Forecast', description: 'A forecast', handler: expect.any(Function) },
    ]);
    expect(getPlugin('weather-forecast')?.name).toBe('Weather Forecast');
  });

  it('ignores non-.js files', () => {
    writeFixture(dir, 'README.md', '# not a plugin');
    writeFixture(dir, 'notes.txt', 'not a plugin either');

    loadPlugins(dir);

    expect(listPlugins()).toEqual([]);
  });

  it('skips a file missing required fields, with a warning, but still loads valid siblings', () => {
    writeFixture(dir, 'broken.js', `module.exports = { name: 'Broken' };`); // no description/handler
    writeFixture(dir, 'good.js', `module.exports = { name: 'Good', description: 'ok', handler: () => ({ blocks: [] }) };`);

    loadPlugins(dir);

    expect(listPlugins().map((p) => p.id)).toEqual(['good']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('broken.js'));
  });

  it('skips a file that throws when required, with a warning', () => {
    writeFixture(dir, 'throws.js', `throw new Error('boom');`);

    loadPlugins(dir);

    expect(listPlugins()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('throws.js'));
  });

  it('warns and results in an empty registry when the directory does not exist', () => {
    loadPlugins(path.join(dir, 'does-not-exist'));

    expect(listPlugins()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not read PLUGINS_DIR'));
  });

  it('replaces the registry (not append) on a second load', () => {
    writeFixture(dir, 'one.js', `module.exports = { name: 'One', description: 'd', handler: () => ({ blocks: [] }) };`);
    loadPlugins(dir);
    expect(listPlugins().map((p) => p.id)).toEqual(['one']);

    fs.rmSync(path.join(dir, 'one.js'));
    writeFixture(dir, 'two.js', `module.exports = { name: 'Two', description: 'd', handler: () => ({ blocks: [] }) };`);
    loadPlugins(dir);

    expect(listPlugins().map((p) => p.id)).toEqual(['two']);
    expect(getPlugin('one')).toBeUndefined();
  });
});
