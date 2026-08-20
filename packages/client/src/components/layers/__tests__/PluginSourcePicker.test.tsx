import { render, screen, waitFor } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LayerDTO } from '@mad-maps/shared';
import { PluginSourcePicker } from '../PluginSourcePicker';
import { fetchPlugins } from '../../../lib/plugins/api';

// lib/plugins/api.ts imports the real apiClient, which reads import.meta.env
// — not transformable by Jest's CJS setup (see AddExternalLayerDialog.test.tsx's
// identical comment). An explicit factory avoids Jest ever loading the real
// module to build an automock.
jest.mock('../../../lib/plugins/api', () => ({
  fetchPlugins: jest.fn(),
  pluginsQueryKey: () => ['plugins'],
}));

const mockFetchPlugins = fetchPlugins as jest.MockedFunction<typeof fetchPlugins>;

const baseLayer: LayerDTO = {
  id: 'layer-1',
  mapId: 'map-1',
  name: 'Weather Pins',
  orderIndex: 0,
  visible: true,
  color: '#1976d2',
  defaultIcon: 'marker',
  opacity: 1,
  sourceType: 'local',
  sourceUrl: null,
  sourceLayer: null,
  pmtilesMetadata: null,
  styleConfig: null,
  pluginEndpointUrl: null,
  pluginId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPicker(layer: LayerDTO, onPluginIdChange = jest.fn(), onPluginEndpointUrlChange = jest.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PluginSourcePicker layer={layer} onPluginIdChange={onPluginIdChange} onPluginEndpointUrlChange={onPluginEndpointUrlChange} />
    </QueryClientProvider>,
  );
  return { onPluginIdChange, onPluginEndpointUrlChange };
}

describe('PluginSourcePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to the URL field when neither pluginId nor pluginEndpointUrl is set', async () => {
    mockFetchPlugins.mockResolvedValue([]);
    renderPicker(baseLayer);

    expect(screen.getByPlaceholderText('https://example.com/plugin')).toBeInTheDocument();
  });

  it('disables the "Installed plugin" toggle when no plugins are loaded', async () => {
    mockFetchPlugins.mockResolvedValue([]);
    renderPicker(baseLayer);

    expect(await screen.findByRole('button', { name: 'Installed plugin' })).toBeDisabled();
  });

  it('defaults to the installed-plugin view when the layer already has a pluginId', async () => {
    mockFetchPlugins.mockResolvedValue([{ id: 'weather-forecast', name: 'Weather Forecast', description: 'A forecast' }]);
    renderPicker({ ...baseLayer, pluginId: 'weather-forecast' });

    expect(await screen.findByText('Weather Forecast')).toBeInTheDocument();
    expect(screen.getByText('A forecast')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('https://example.com/plugin')).not.toBeInTheDocument();
  });

  it('selecting a plugin calls onPluginIdChange with its id', async () => {
    mockFetchPlugins.mockResolvedValue([{ id: 'weather-forecast', name: 'Weather Forecast', description: 'A forecast' }]);
    const user = userEventModule.setup();
    const { onPluginIdChange } = renderPicker({ ...baseLayer, pluginId: null });

    await user.click(await screen.findByRole('button', { name: 'Installed plugin' }));
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Weather Forecast' }));

    expect(onPluginIdChange).toHaveBeenCalledWith('weather-forecast');
  });

  it('typing a valid URL in Custom URL mode calls onPluginEndpointUrlChange after debounce', async () => {
    mockFetchPlugins.mockResolvedValue([]);
    const user = userEventModule.setup();
    const { onPluginEndpointUrlChange } = renderPicker(baseLayer);

    await user.type(screen.getByPlaceholderText('https://example.com/plugin'), 'https://example.com/plugin');

    await waitFor(() => expect(onPluginEndpointUrlChange).toHaveBeenCalledWith('https://example.com/plugin'));
  });

  it('does not call onPluginEndpointUrlChange while the URL is incomplete', async () => {
    mockFetchPlugins.mockResolvedValue([]);
    const user = userEventModule.setup();
    const { onPluginEndpointUrlChange } = renderPicker(baseLayer);

    await user.type(screen.getByPlaceholderText('https://example.com/plugin'), 'not-a-url');
    await new Promise((r) => setTimeout(r, 600));

    expect(onPluginEndpointUrlChange).not.toHaveBeenCalled();
  });
});
