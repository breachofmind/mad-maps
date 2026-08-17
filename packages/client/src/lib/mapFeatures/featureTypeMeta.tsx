import type { FeatureType } from '@mad-maps/shared';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import PentagonIcon from '@mui/icons-material/Pentagon';
import TextFieldsIcon from '@mui/icons-material/TextFields';

// Matches the icons DrawControls already uses for these tools, so the same
// shape means "point"/"line"/"polygon" everywhere in the app.
export const FEATURE_TYPE_ICONS: Record<FeatureType, typeof PlaceIcon> = {
  point: PlaceIcon,
  line: TimelineIcon,
  polygon: PentagonIcon,
  text: TextFieldsIcon,
};

export const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  point: 'Pin',
  line: 'Line',
  polygon: 'Polygon',
  text: 'Text',
};
