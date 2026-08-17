import { render, screen, waitFor } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  activeStyleUrl: string;
  onChange?: (styleUrl: string) => void;
  onManageStyles?: () => void;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BaseLayerPanel
        activeStyleUrl={props.activeStyleUrl}
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
    renderPanel({ activeStyleUrl: MAP_STYLE_OPTIONS[0].styleUrl });

    expect(screen.getByText(MAP_STYLE_OPTIONS[0].label)).toBeInTheDocument();
  });

  it('shows "Custom style" when activeStyleUrl matches no preset or saved style', () => {
    renderPanel({ activeStyleUrl: 'mapbox://styles/someone/unmatched' });

    expect(screen.getByText('Custom style')).toBeInTheDocument();
  });

  it('shows a saved custom style by name when it matches activeStyleUrl', async () => {
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

    renderPanel({ activeStyleUrl: 'mapbox://styles/someone/custom' });

    await waitFor(() => expect(screen.getByText('My Custom Style')).toBeInTheDocument());
  });

  it('calls onChange with the selected style url', async () => {
    const user = userEventModule.setup();
    const onChange = jest.fn();
    const [first, second] = MAP_STYLE_OPTIONS;

    renderPanel({ activeStyleUrl: first.styleUrl, onChange });
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: second.label }));

    expect(onChange).toHaveBeenCalledWith(second.styleUrl);
  });

  it('calls onManageStyles when the manage-styles icon is clicked', async () => {
    const user = userEventModule.setup();
    const onManageStyles = jest.fn();

    renderPanel({ activeStyleUrl: MAP_STYLE_OPTIONS[0].styleUrl, onManageStyles });
    await user.click(screen.getByRole('button', { name: 'Manage map styles' }));

    expect(onManageStyles).toHaveBeenCalledTimes(1);
  });
});
