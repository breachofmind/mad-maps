import { render, screen, waitFor } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PluginDataSection } from '../PluginDataSection';
import { fetchPluginPanelData } from '../../../lib/layers/api';

// api.ts imports the real apiClient, which reads import.meta.env — not
// transformable by Jest's CJS setup (see AddExternalLayerDialog.test.tsx's
// identical comment). An explicit factory avoids Jest ever loading the real
// module to build an automock.
jest.mock('../../../lib/layers/api', () => ({
  fetchPluginPanelData: jest.fn(),
  pluginPanelDataQueryKey: (layerId: string, featureId: string) => ['layers', layerId, 'features', featureId, 'plugin-data'],
}));

const mockFetchPluginPanelData = fetchPluginPanelData as jest.MockedFunction<typeof fetchPluginPanelData>;

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PluginDataSection layerId="layer-1" featureId="feature-1" />
    </QueryClientProvider>,
  );
}

describe('PluginDataSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the blocks returned by the plugin endpoint', async () => {
    mockFetchPluginPanelData.mockResolvedValue({ blocks: [{ type: 'heading', text: '5-Day Forecast' }] });

    renderSection();

    expect(await screen.findByText('5-Day Forecast')).toBeInTheDocument();
    expect(mockFetchPluginPanelData).toHaveBeenCalledWith('layer-1', 'feature-1');
  });

  it('shows an error state when the fetch fails', async () => {
    mockFetchPluginPanelData.mockRejectedValue(new Error('network error'));

    renderSection();

    expect(await screen.findByText("Couldn't load data from this layer's plugin.")).toBeInTheDocument();
  });

  it('shows an empty state when the plugin returns no blocks', async () => {
    mockFetchPluginPanelData.mockResolvedValue({ blocks: [] });

    renderSection();

    expect(await screen.findByText('The plugin returned no data for this pin.')).toBeInTheDocument();
  });

  it('forces a fresh fetch when the refresh button is clicked', async () => {
    mockFetchPluginPanelData.mockResolvedValue({ blocks: [{ type: 'heading', text: 'Cached' }] });
    const user = userEventModule.setup();

    renderSection();
    await screen.findByText('Cached');

    mockFetchPluginPanelData.mockResolvedValue({ blocks: [{ type: 'heading', text: 'Fresh' }] });
    await user.click(screen.getByRole('button', { name: 'Refresh plugin data' }));

    expect(await screen.findByText('Fresh')).toBeInTheDocument();
    expect(mockFetchPluginPanelData).toHaveBeenLastCalledWith('layer-1', 'feature-1', { force: true });
  });

  it('collapses and expands the section', async () => {
    mockFetchPluginPanelData.mockResolvedValue({ blocks: [{ type: 'heading', text: '5-Day Forecast' }] });
    const user = userEventModule.setup();

    renderSection();
    await screen.findByText('5-Day Forecast');

    await user.click(screen.getByRole('button', { name: 'Collapse plugin data' }));
    await waitFor(() => expect(screen.getByText('5-Day Forecast')).not.toBeVisible());

    await user.click(screen.getByRole('button', { name: 'Expand plugin data' }));
    await waitFor(() => expect(screen.getByText('5-Day Forecast')).toBeVisible());
  });
});
