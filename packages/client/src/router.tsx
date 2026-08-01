import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { LoginPage } from './features/auth/components/LoginPage';
import { MapsListPage } from './features/maps/components/MapsListPage';
import { MapEditorPage } from './features/map/components/MapEditorPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <MapsListPage /> },
      { path: 'maps/:mapId', element: <MapEditorPage /> },
    ],
  },
]);
