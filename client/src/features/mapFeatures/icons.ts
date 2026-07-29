import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';
import HomeIcon from '@mui/icons-material/Home';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import TerrainIcon from '@mui/icons-material/Terrain';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import WarningIcon from '@mui/icons-material/Warning';

export const FEATURE_ICONS = {
  marker: PlaceIcon,
  star: StarIcon,
  flag: FlagIcon,
  home: HomeIcon,
  restaurant: RestaurantIcon,
  cafe: LocalCafeIcon,
  terrain: TerrainIcon,
  camera: PhotoCameraIcon,
  parking: LocalParkingIcon,
  warning: WarningIcon,
} as const;

export type FeatureIconName = keyof typeof FEATURE_ICONS;

export const FEATURE_ICON_NAMES = Object.keys(FEATURE_ICONS) as FeatureIconName[];
