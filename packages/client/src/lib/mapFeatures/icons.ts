import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';
import FavoriteIcon from '@mui/icons-material/Favorite';
import InfoIcon from '@mui/icons-material/Info';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';
import HomeIcon from '@mui/icons-material/Home';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

import TerrainIcon from '@mui/icons-material/Terrain';
import ParkIcon from '@mui/icons-material/Park';
import ForestIcon from '@mui/icons-material/Forest';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import LandscapeIcon from '@mui/icons-material/Landscape';
import WavesIcon from '@mui/icons-material/Waves';
import HikingIcon from '@mui/icons-material/Hiking';
import CabinIcon from '@mui/icons-material/Cabin';

import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import LocalPizzaIcon from '@mui/icons-material/LocalPizza';
import IcecreamIcon from '@mui/icons-material/Icecream';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import FastfoodIcon from '@mui/icons-material/Fastfood';

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import TrainIcon from '@mui/icons-material/Train';
import FlightIcon from '@mui/icons-material/Flight';
import LocalTaxiIcon from '@mui/icons-material/LocalTaxi';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import EvStationIcon from '@mui/icons-material/EvStation';
import AnchorIcon from '@mui/icons-material/Anchor';

import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import LocalPoliceIcon from '@mui/icons-material/LocalPolice';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import LocalPostOfficeIcon from '@mui/icons-material/LocalPostOffice';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SchoolIcon from '@mui/icons-material/School';
import ChurchIcon from '@mui/icons-material/Church';

import LocalMallIcon from '@mui/icons-material/LocalMall';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalGroceryStoreIcon from '@mui/icons-material/LocalGroceryStore';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';

import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import PoolIcon from '@mui/icons-material/Pool';
import MuseumIcon from '@mui/icons-material/Museum';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import StadiumIcon from '@mui/icons-material/Stadium';
import CasinoIcon from '@mui/icons-material/Casino';
import AttractionsIcon from '@mui/icons-material/Attractions';

import BusinessIcon from '@mui/icons-material/Business';
import ApartmentIcon from '@mui/icons-material/Apartment';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import LocalHotelIcon from '@mui/icons-material/LocalHotel';
import ConstructionIcon from '@mui/icons-material/Construction';
import FactoryIcon from '@mui/icons-material/Factory';

import CakeIcon from '@mui/icons-material/Cake';
import PetsIcon from '@mui/icons-material/Pets';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import WcIcon from '@mui/icons-material/Wc';
import WifiIcon from '@mui/icons-material/Wifi';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BuildIcon from '@mui/icons-material/Build';

export const FEATURE_ICONS = {
  marker: PlaceIcon,
  star: StarIcon,
  flag: FlagIcon,
  favorite: FavoriteIcon,
  info: InfoIcon,
  help: HelpOutlineIcon,
  warning: WarningIcon,
  home: HomeIcon,
  camera: PhotoCameraIcon,

  terrain: TerrainIcon,
  park: ParkIcon,
  forest: ForestIcon,
  beach: BeachAccessIcon,
  landscape: LandscapeIcon,
  waves: WavesIcon,
  hiking: HikingIcon,
  cabin: CabinIcon,

  restaurant: RestaurantIcon,
  cafe: LocalCafeIcon,
  bar: LocalBarIcon,
  pizza: LocalPizzaIcon,
  icecream: IcecreamIcon,
  drink: LocalDrinkIcon,
  fastfood: FastfoodIcon,

  car: DirectionsCarIcon,
  bus: DirectionsBusIcon,
  boat: DirectionsBoatIcon,
  bike: DirectionsBikeIcon,
  train: TrainIcon,
  flight: FlightIcon,
  taxi: LocalTaxiIcon,
  parking: LocalParkingIcon,
  gasStation: LocalGasStationIcon,
  evStation: EvStationIcon,
  anchor: AnchorIcon,

  hospital: LocalHospitalIcon,
  pharmacy: LocalPharmacyIcon,
  police: LocalPoliceIcon,
  fireDepartment: LocalFireDepartmentIcon,
  library: LocalLibraryIcon,
  postOffice: LocalPostOfficeIcon,
  atm: LocalAtmIcon,
  bank: AccountBalanceIcon,
  school: SchoolIcon,
  church: ChurchIcon,

  mall: LocalMallIcon,
  store: StorefrontIcon,
  grocery: LocalGroceryStoreIcon,
  laundry: LocalLaundryServiceIcon,
  florist: LocalFloristIcon,

  soccer: SportsSoccerIcon,
  basketball: SportsBasketballIcon,
  tennis: SportsTennisIcon,
  gym: FitnessCenterIcon,
  pool: PoolIcon,
  museum: MuseumIcon,
  theater: TheaterComedyIcon,
  stadium: StadiumIcon,
  casino: CasinoIcon,
  attraction: AttractionsIcon,

  business: BusinessIcon,
  apartment: ApartmentIcon,
  city: LocationCityIcon,
  hotel: LocalHotelIcon,
  construction: ConstructionIcon,
  factory: FactoryIcon,

  cake: CakeIcon,
  pets: PetsIcon,
  childcare: ChildCareIcon,
  restroom: WcIcon,
  wifi: WifiIcon,
  shipping: LocalShippingIcon,
  build: BuildIcon,
} as const;

export type FeatureIconName = keyof typeof FEATURE_ICONS;

export const FEATURE_ICON_NAMES = Object.keys(FEATURE_ICONS) as FeatureIconName[];

export interface FeatureIconCategory {
  label: string;
  names: FeatureIconName[];
}

export const FEATURE_ICON_CATEGORIES: FeatureIconCategory[] = [
  { label: 'General', names: ['marker', 'star', 'flag', 'favorite', 'info', 'help', 'warning', 'home', 'camera'] },
  {
    label: 'Nature & Outdoors',
    names: ['terrain', 'park', 'forest', 'beach', 'landscape', 'waves', 'hiking', 'cabin'],
  },
  { label: 'Food & Drink', names: ['restaurant', 'cafe', 'bar', 'pizza', 'icecream', 'drink', 'fastfood'] },
  {
    label: 'Transportation',
    names: ['car', 'bus', 'boat', 'bike', 'train', 'flight', 'taxi', 'parking', 'gasStation', 'evStation', 'anchor'],
  },
  {
    label: 'Services',
    names: ['hospital', 'pharmacy', 'police', 'fireDepartment', 'library', 'postOffice', 'atm', 'bank', 'school', 'church'],
  },
  { label: 'Shopping', names: ['mall', 'store', 'grocery', 'laundry', 'florist'] },
  {
    label: 'Recreation',
    names: ['soccer', 'basketball', 'tennis', 'gym', 'pool', 'museum', 'theater', 'stadium', 'casino', 'attraction'],
  },
  { label: 'Buildings', names: ['business', 'apartment', 'city', 'hotel', 'construction', 'factory'] },
  { label: 'Other', names: ['cake', 'pets', 'childcare', 'restroom', 'wifi', 'shipping', 'build'] },
];
