import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../components/auth/LoginPage';
import { MapsListPage } from '../components/maps/MapsListPage';
import { MapEditorPage } from '../components/map/MapEditorPage';

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
