import { pluginMetadataSchema, pluginPanelResponseSchema } from './pluginPanel';

describe('pluginPanelResponseSchema', () => {
  it('accepts a well-formed response with one of each block type', () => {
    const result = pluginPanelResponseSchema.safeParse({
      blocks: [
        { type: 'heading', text: '5-Day Forecast' },
        { type: 'text', text: 'Sunny with a chance of showers.' },
        { type: 'keyValue', items: [{ label: 'Today', value: '72°F, Sunny' }] },
        { type: 'image', url: 'https://example.com/forecast.png', alt: 'Forecast chart' },
        { type: 'link', text: 'Full forecast', href: 'https://example.com/forecast' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty blocks array', () => {
    expect(pluginPanelResponseSchema.safeParse({ blocks: [] }).success).toBe(true);
  });

  it('rejects an unknown block type', () => {
    const result = pluginPanelResponseSchema.safeParse({ blocks: [{ type: 'video', url: 'https://example.com' }] });
    expect(result.success).toBe(false);
  });

  it('rejects an image block with a javascript: URL', () => {
    const result = pluginPanelResponseSchema.safeParse({
      blocks: [{ type: 'image', url: 'javascript:alert(1)' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a link block with a javascript: href', () => {
    const result = pluginPanelResponseSchema.safeParse({
      blocks: [{ type: 'link', text: 'Click me', href: 'javascript:alert(1)' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 50 blocks', () => {
    const tooMany = Array.from({ length: 51 }, () => ({ type: 'text' as const, text: 'x' }));
    expect(pluginPanelResponseSchema.safeParse({ blocks: tooMany }).success).toBe(false);
  });

  it('rejects a keyValue block with more than 20 items', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({ label: `k${i}`, value: 'v' }));
    const result = pluginPanelResponseSchema.safeParse({
      blocks: [{ type: 'keyValue', items: tooMany }],
    });
    expect(result.success).toBe(false);
  });
});

describe('pluginMetadataSchema', () => {
  it('accepts a well-formed name/description', () => {
    const result = pluginMetadataSchema.safeParse({ name: 'Weather Forecast', description: 'A 5-day forecast' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    expect(pluginMetadataSchema.safeParse({ description: 'A 5-day forecast' }).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(pluginMetadataSchema.safeParse({ name: '', description: 'x' }).success).toBe(false);
  });

  it('accepts an empty description', () => {
    expect(pluginMetadataSchema.safeParse({ name: 'Weather Forecast', description: '' }).success).toBe(true);
  });
});
