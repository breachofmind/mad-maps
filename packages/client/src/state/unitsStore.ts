import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AreaUnit, DistanceUnit } from '../features/mapFeatures/lib/geometryMeasurements';

interface UnitsState {
  distanceUnit: DistanceUnit;
  areaUnit: AreaUnit;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setAreaUnit: (unit: AreaUnit) => void;
}

export const useUnitsStore = create<UnitsState>()(
  persist(
    (set) => ({
      distanceUnit: 'meters',
      areaUnit: 'squareMeters',
      setDistanceUnit: (unit) => set({ distanceUnit: unit }),
      setAreaUnit: (unit) => set({ areaUnit: unit }),
    }),
    { name: 'mapinski-measurement-units' },
  ),
);
