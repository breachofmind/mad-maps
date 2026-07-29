import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { MapsListPage } from './features/maps/MapsListPage';
import { MapEditorPage } from './features/map/MapEditorPage';

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
