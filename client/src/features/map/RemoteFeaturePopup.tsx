import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import { mapboxgl } from './mapbox';

const MAX_PROPERTIES_SHOWN = 15;
const MAX_VALUE_LENGTH = 200;

export interface RemoteFeatureSelection {
  feature: GeoJSON.Feature;
  layerName: string;
  layerColor: string;
  lngLat: [number, number];
}

interface RemoteFeaturePopupProps {
  map: mapboxgl.Map | null;
  selection: RemoteFeatureSelection | null;
  onClose: () => void;
}

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

// Raw property values from an external data source are rendered as plain
// text via JSX (not dangerouslySetInnerHTML), so React already escapes
// them — no DOMPurify sanitization needed here, unlike FeaturePopup's
// descriptionHtml, which is rendered as HTML.
export function RemoteFeaturePopup({ map, selection, onClose }: RemoteFeaturePopupProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!map || !selection) return;

    const container = document.createElement('div');
    const root: Root = createRoot(container);
    const entries = Object.entries(selection.feature.properties ?? {}).slice(0, MAX_PROPERTIES_SHOWN);

    root.render(
      <Stack spacing={0.5} sx={{ maxWidth: 280 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selection.layerColor, flexShrink: 0 }} />
            <Typography variant="subtitle2">{selection.layerName}</Typography>
          </Stack>
          <Tooltip title="Close">
            <IconButton size="small" onClick={() => onCloseRef.current()} aria-label="Close popup">
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
        {entries.length > 0 ? (
          <Stack spacing={0.25}>
            {entries.map(([key, value]) => (
              <Stack key={key} direction="row" spacing={1} justifyContent="space-between">
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {key}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'right', wordBreak: 'break-word' }}>
                  {formatPropertyValue(value)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            No properties on this feature.
          </Typography>
        )}
      </Stack>,
    );

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
      .setLngLat(selection.lngLat)
      .setDOMContent(container)
      .addTo(map);

    return () => {
      popup.remove();
      root.unmount();
    };
  }, [map, selection]);

  return null;
}
