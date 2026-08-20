import { render, screen, waitFor } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddExternalLayerDialog } from '../AddExternalLayerDialog';
import { createLayer, inspectPmtiles } from '../../../lib/layers/api';

// api.ts imports the real apiClient, which reads import.meta.env — not
// transformable by Jest's CJS setup (see lib/map/featureLayerIds.ts's own
// comment about this same constraint). An explicit factory avoids Jest ever
// loading the real module to build an automock.
jest.mock('../../../lib/layers/api', () => ({
  createLayer: jest.fn(),
  deleteLayer: jest.fn(),
  fetchExternalLayerData: jest.fn(),
  inspectPmtiles: jest.fn(),
  layersQueryKey: (mapId: string) => ['maps', mapId, 'layers'],
}));

const mockCreateLayer = createLayer as jest.MockedFunction<typeof createLayer>;
const mockInspectPmtiles = inspectPmtiles as jest.MockedFunction<typeof inspectPmtiles>;

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddExternalLayerDialog open onClose={() => {}} mapId="map-1" />
    </QueryClientProvider>,
  );
}

async function selectPmtilesOption(user: ReturnType<typeof userEventModule.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Custom PMTiles URL' }));
}

async function selectRasterOption(user: ReturnType<typeof userEventModule.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Custom raster tile URL' }));
}

describe('AddExternalLayerDialog PMTiles flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reveals name/url fields when Custom PMTiles URL is selected', async () => {
    const user = userEventModule.setup();
    renderDialog();

    await selectPmtilesOption(user);

    expect(screen.getByLabelText('Layer name')).toBeInTheDocument();
    expect(screen.getByLabelText('PMTiles URL')).toBeInTheDocument();
  });

  it('auto-selects the source layer and enables submit when the archive has exactly one', async () => {
    mockInspectPmtiles.mockResolvedValue({
      layers: [{ id: 'roads', fields: { name: 'String' } }],
      minzoom: 0,
      maxzoom: 14,
    });
    mockCreateLayer.mockResolvedValue({
      id: 'layer-1',
      mapId: 'map-1',
      name: 'Roads',
      orderIndex: 0,
      visible: true,
      color: '#1976d2',
      defaultIcon: 'marker',
      opacity: 1,
      sourceType: 'pmtiles-url',
      sourceUrl: 'https://example.com/data.pmtiles',
      sourceLayer: 'roads',
      pmtilesMetadata: { layers: [{ id: 'roads', fields: { name: 'String' } }], minzoom: 0, maxzoom: 14 },
      styleConfig: null,
      pluginEndpointUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const user = userEventModule.setup();
    renderDialog();
    await selectPmtilesOption(user);

    await user.type(screen.getByLabelText('Layer name'), 'Roads');
    await user.type(screen.getByLabelText('PMTiles URL'), 'https://example.com/data.pmtiles');

    await waitFor(() => expect(mockInspectPmtiles).toHaveBeenCalledWith('https://example.com/data.pmtiles'), {
      timeout: 2000,
    });

    const submitButton = await screen.findByRole('button', { name: 'Add Layer' });
    await waitFor(() => expect(submitButton).toBeEnabled());

    await user.click(submitButton);

    await waitFor(() =>
      expect(mockCreateLayer).toHaveBeenCalledWith('map-1', 'Roads', 'https://example.com/data.pmtiles', {
        sourceFormat: 'pmtiles',
        sourceLayer: 'roads',
        pmtilesMetadata: { layers: [{ id: 'roads', fields: { name: 'String' } }], minzoom: 0, maxzoom: 14 },
      }),
    );
  });

  it('requires an explicit source-layer pick when the archive has more than one', async () => {
    mockInspectPmtiles.mockResolvedValue({
      layers: [
        { id: 'roads', fields: {} },
        { id: 'buildings', fields: {} },
      ],
      minzoom: 0,
      maxzoom: 14,
    });

    const user = userEventModule.setup();
    renderDialog();
    await selectPmtilesOption(user);

    await user.type(screen.getByLabelText('Layer name'), 'Roads');
    await user.type(screen.getByLabelText('PMTiles URL'), 'https://example.com/multi.pmtiles');

    await waitFor(() => expect(mockInspectPmtiles).toHaveBeenCalled(), { timeout: 2000 });

    const sourceLayerSelect = await screen.findByLabelText('Source layer');
    expect(sourceLayerSelect).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Layer' })).toBeDisabled();

    expect(mockCreateLayer).not.toHaveBeenCalled();
  });

  it('shows an error and blocks submit when the URL is not a readable PMTiles archive', async () => {
    mockInspectPmtiles.mockRejectedValue(new Error('Bad request'));

    const user = userEventModule.setup();
    renderDialog();
    await selectPmtilesOption(user);

    await user.type(screen.getByLabelText('Layer name'), 'Roads');
    await user.type(screen.getByLabelText('PMTiles URL'), 'https://example.com/not-pmtiles.txt');

    await waitFor(() => expect(mockInspectPmtiles).toHaveBeenCalled(), { timeout: 2000 });
    await screen.findByText(/Couldn't read that as a PMTiles archive/);

    expect(screen.getByRole('button', { name: 'Add Layer' })).toBeDisabled();
    expect(mockCreateLayer).not.toHaveBeenCalled();
  });
});

describe('AddExternalLayerDialog raster flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reveals name/url fields when Custom raster tile URL is selected', async () => {
    const user = userEventModule.setup();
    renderDialog();

    await selectRasterOption(user);

    expect(screen.getByLabelText('Layer name')).toBeInTheDocument();
    expect(screen.getByLabelText('Raster tile URL')).toBeInTheDocument();
  });

  it('blocks submit until the URL contains {z}/{x}/{y}, then creates the layer with sourceFormat raster', async () => {
    mockCreateLayer.mockResolvedValue({
      id: 'layer-1',
      mapId: 'map-1',
      name: 'Weather Radar',
      orderIndex: 0,
      visible: true,
      color: '#1976d2',
      defaultIcon: 'marker',
      opacity: 1,
      sourceType: 'raster-url',
      sourceUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
      sourceLayer: null,
      pmtilesMetadata: null,
      styleConfig: null,
      pluginEndpointUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const user = userEventModule.setup();
    renderDialog();
    await selectRasterOption(user);

    await user.type(screen.getByLabelText('Layer name'), 'Weather Radar');
    await user.type(screen.getByLabelText('Raster tile URL'), 'https://example.com/tiles.png');
    expect(screen.getByRole('button', { name: 'Add Layer' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Raster tile URL'));
    // user-event's `type` treats `{` as the start of a key-descriptor (e.g.
    // `{enter}`) — `{{` is its documented escape for a literal `{` (see
    // https://testing-library.com/docs/user-event/keyboard); `}` needs no
    // escaping since it isn't a bracket-dict start character.
    await user.type(screen.getByLabelText('Raster tile URL'), 'https://example.com/tiles/{{z}/{{x}/{{y}.png');

    const submitButton = screen.getByRole('button', { name: 'Add Layer' });
    await waitFor(() => expect(submitButton).toBeEnabled());
    await user.click(submitButton);

    await waitFor(() =>
      expect(mockCreateLayer).toHaveBeenCalledWith(
        'map-1',
        'Weather Radar',
        'https://example.com/tiles/{z}/{x}/{y}.png',
        { sourceFormat: 'raster' },
      ),
    );
  });

  it('routes the curated NEXRAD weather radar option through the raster submission path', async () => {
    mockCreateLayer.mockResolvedValue({
      id: 'layer-1',
      mapId: 'map-1',
      name: 'Weather Radar (NEXRAD, live)',
      orderIndex: 0,
      visible: true,
      color: '#1976d2',
      defaultIcon: 'marker',
      opacity: 1,
      sourceType: 'raster-url',
      sourceUrl: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
      sourceLayer: null,
      pmtilesMetadata: null,
      styleConfig: null,
      pluginEndpointUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const user = userEventModule.setup();
    renderDialog();

    const submitButton = screen.getByRole('button', { name: 'Add Layer' });
    await user.click(screen.getByRole('radio', { name: /Weather Radar \(NEXRAD, live\)/ }));
    await waitFor(() => expect(submitButton).toBeEnabled());
    await user.click(submitButton);

    await waitFor(() =>
      expect(mockCreateLayer).toHaveBeenCalledWith(
        'map-1',
        'Weather Radar (NEXRAD, live)',
        'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
        { sourceFormat: 'raster' },
      ),
    );
  });
});
