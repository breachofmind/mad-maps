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

  it('renders a table block with headers, text cells, and an image cell', () => {
    renderBlock({
      type: 'table',
      headers: ['Day', 'High', 'Low', 'Condition'],
      rows: [
        [
          { type: 'text', text: 'Thu' },
          { type: 'text', text: '74°F' },
          { type: 'text', text: '61°F' },
          { type: 'image', url: 'https://example.com/icons/rain.svg', alt: 'Rain' },
        ],
      ],
    });

    expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Condition' })).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('74°F')).toBeInTheDocument();
    expect(screen.getByText('61°F')).toBeInTheDocument();
    expect(screen.getByAltText('Rain')).toHaveAttribute('src', 'https://example.com/icons/rain.svg');
  });

  it('renders a table block with no headers', () => {
    renderBlock({ type: 'table', headers: [], rows: [[{ type: 'text', text: 'lone cell' }]] });

    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    expect(screen.getByText('lone cell')).toBeInTheDocument();
  });

  it('renders a table with rows shorter than the header count without throwing', () => {
    renderBlock({
      type: 'table',
      headers: ['A', 'B', 'C'],
      rows: [[{ type: 'text', text: 'only-one' }]],
    });

    expect(screen.getByText('only-one')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // header row + one body row
  });
});
