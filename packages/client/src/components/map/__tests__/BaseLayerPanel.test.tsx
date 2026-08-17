import { render, screen, waitFor } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BaseStyle } from '@mad-maps/shared';
import { BaseLayerPanel } from '../BaseLayerPanel';
import { MAP_STYLE_OPTIONS } from '../../../lib/map/mapStyles';
import { fetchMapStyles } from '../../../lib/mapStyles/api';

// api.ts imports the real apiClient, which reads import.meta.env — not
// transformable by Jest's CJS setup (see lib/map/featureLayerIds.ts's own
// comment about this same constraint). An explicit factory avoids Jest ever
// loading the real module to build an automock.
jest.mock('../../../lib/mapStyles/api', () => ({
  fetchMapStyles: jest.fn(),
  mapStylesQueryKey: () => ['mapStyles'],
}));

const mockFetchMapStyles = fetchMapStyles as jest.MockedFunction<typeof fetchMapStyles>;

function renderPanel(props: {
  activeStyle: BaseStyle;
  onChange?: (style: BaseStyle) => void;
  onManageStyles?: () => void;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BaseLayerPanel
        activeStyle={props.activeStyle}
        onChange={props.onChange ?? (() => {})}
        onManageStyles={props.onManageStyles ?? (() => {})}
      />
    </QueryClientProvider>,
  );
}

describe('BaseLayerPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMapStyles.mockResolvedValue([]);
  });

  it('shows the active preset style label', () => {
    renderPanel({ activeStyle: MAP_STYLE_OPTIONS[0].style });

    expect(screen.getByText(MAP_STYLE_OPTIONS[0].label)).toBeInTheDocument();
  });

  it('shows the active preset style label for an inline style object', () => {
    const usgsTopo = MAP_STYLE_OPTIONS.find((option) => option.id === 'usgs-topo')!;
    renderPanel({ activeStyle: usgsTopo.style });

    expect(screen.getByText(usgsTopo.label)).toBeInTheDocument();
  });

  it('still matches an inline style object whose keys the server reordered', () => {
    // Postgres's jsonb column alphabetizes object keys (at every nesting
    // level) on write, so a style round-tripped through the API has
    // different key order than the client's own literal — the match must be
    // content-based, not string-order-based.
    function sortKeysDeep(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(sortKeysDeep);
      if (value !== null && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
            return acc;
          }, {});
      }
      return value;
    }

    const usgsTopo = MAP_STYLE_OPTIONS.find((option) => option.id === 'usgs-topo')!;
    const reordered = sortKeysDeep(usgsTopo.style);

    renderPanel({ activeStyle: reordered as typeof usgsTopo.style });

    expect(screen.getByText(usgsTopo.label)).toBeInTheDocument();
  });

  it('shows "Custom style" when activeStyle matches no preset or saved style', () => {
    renderPanel({ activeStyle: 'mapbox://styles/someone/unmatched' });

    expect(screen.getByText('Custom style')).toBeInTheDocument();
  });

  it('shows a saved custom style by name when it matches activeStyle', async () => {
    mockFetchMapStyles.mockResolvedValue([
      {
        id: 'style-1',
        ownerId: 'owner-1',
        name: 'My Custom Style',
        styleUrl: 'mapbox://styles/someone/custom',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    renderPanel({ activeStyle: 'mapbox://styles/someone/custom' });

    await waitFor(() => expect(screen.getByText('My Custom Style')).toBeInTheDocument());
  });

  it('calls onChange with the selected style', async () => {
    const user = userEventModule.setup();
    const onChange = jest.fn();
    const [first, second] = MAP_STYLE_OPTIONS;

    renderPanel({ activeStyle: first.style, onChange });
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: second.label }));

    expect(onChange).toHaveBeenCalledWith(second.style);
  });

  it('calls onManageStyles when the manage-styles icon is clicked', async () => {
    const user = userEventModule.setup();
    const onManageStyles = jest.fn();

    renderPanel({ activeStyle: MAP_STYLE_OPTIONS[0].style, onManageStyles });
    await user.click(screen.getByRole('button', { name: 'Manage map styles' }));

    expect(onManageStyles).toHaveBeenCalledTimes(1);
  });
});
