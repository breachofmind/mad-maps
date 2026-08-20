import { render, screen } from '@testing-library/react';
import type { PluginPanelBlock } from '@mad-maps/shared';
import { PluginBlockRenderer } from '../PluginBlockRenderer';

function renderBlock(block: PluginPanelBlock) {
  return render(<PluginBlockRenderer block={block} />);
}

describe('PluginBlockRenderer', () => {
  it('renders a heading block', () => {
    renderBlock({ type: 'heading', text: '5-Day Forecast' });
    expect(screen.getByText('5-Day Forecast')).toBeInTheDocument();
  });

  it('renders a text block', () => {
    renderBlock({ type: 'text', text: 'Sunny with a chance of showers.' });
    expect(screen.getByText('Sunny with a chance of showers.')).toBeInTheDocument();
  });

  it('renders a keyValue block as label/value rows', () => {
    renderBlock({
      type: 'keyValue',
      items: [
        { label: 'Today', value: '72°F, Sunny' },
        { label: 'Tomorrow', value: '68°F, Rain' },
      ],
    });
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('72°F, Sunny')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('68°F, Rain')).toBeInTheDocument();
  });

  it('renders an image block with alt text', () => {
    renderBlock({ type: 'image', url: 'https://example.com/forecast.png', alt: 'Forecast chart' });
    expect(screen.getByAltText('Forecast chart')).toHaveAttribute('src', 'https://example.com/forecast.png');
  });

  it('renders a link block that opens in a new tab safely', () => {
    renderBlock({ type: 'link', text: 'Full forecast', href: 'https://example.com/forecast' });
    const link = screen.getByRole('link', { name: 'Full forecast' });
    expect(link).toHaveAttribute('href', 'https://example.com/forecast');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
