import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import DOMPurify from 'dompurify';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import type { MapFeatureDTO } from '@mapinski/shared';
import { mapboxgl } from '../../lib/map/mapbox';
import { geometryAnchor } from '../../lib/map/geometryAnchor';
import { FEATURE_ICONS, type FeatureIconName } from '../../lib/mapFeatures/icons';
import { formatCoordinates } from '../../lib/mapFeatures/geometryMeasurements';
import { SANITIZE_CONFIG } from '../../lib/mapFeatures/sanitizeConfig';

interface FeaturePopupProps {
  map: mapboxgl.Map | null;
  feature: MapFeatureDTO | null;
  onClose: () => void;
}

export function FeaturePopup({ map, feature, onClose }: FeaturePopupProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!map || !feature) return;

    const container = document.createElement('div');
    const root: Root = createRoot(container);

    const Icon = FEATURE_ICONS[feature.properties.icon as FeatureIconName] ?? FEATURE_ICONS.marker;
    const sanitizedDescription = DOMPurify.sanitize(feature.properties.descriptionHtml, SANITIZE_CONFIG);
    const coordinates = feature.geometry.type === 'Point' ? formatCoordinates(feature.geometry.coordinates) : null;

    root.render(
      <Stack spacing={0.5} sx={{ maxWidth: 240 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Icon fontSize="small" sx={{ color: feature.properties.color }} />
            <Typography variant="subtitle2">{feature.properties.title || 'Untitled'}</Typography>
          </Stack>
          <Tooltip title="Close">
            <IconButton size="small" onClick={() => onCloseRef.current()} aria-label="Close popup">
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
        {coordinates && (
          <Typography variant="caption" color="text.secondary">
            {coordinates}
          </Typography>
        )}
        {sanitizedDescription && (
          <Box
            sx={{ fontSize: 13, color: 'text.secondary', '& p': { m: 0 } }}
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        )}
      </Stack>,
    );

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 20 })
      .setLngLat(geometryAnchor(feature.geometry))
      .setDOMContent(container)
      .addTo(map);

    return () => {
      popup.remove();
      root.unmount();
    };
  }, [map, feature]);

  return null;
}
