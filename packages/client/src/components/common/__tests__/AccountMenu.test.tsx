import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountMenu } from '../AccountMenu';
import { fetchCurrentUser, logout } from '../../../lib/auth/api';

// api.ts imports the real apiClient, which reads import.meta.env — not
// transformable by Jest's CJS setup (see AddExternalLayerDialog.test.tsx's
// own comment about this same constraint).
jest.mock('../../../lib/auth/api', () => ({
  fetchCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

const mockFetchCurrentUser = fetchCurrentUser as jest.MockedFunction<typeof fetchCurrentUser>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;

function renderMenu(anchorEl: HTMLElement, onClose: () => void = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountMenu anchorEl={anchorEl} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe('AccountMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
  });

  it('shows the signed-in user\'s email', async () => {
    mockFetchCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'mike@breachofmind.com',
      displayName: 'Mike',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    renderMenu(document.body);

    expect(await screen.findByText('mike@breachofmind.com')).toBeInTheDocument();
  });

  it('calls logout and onClose when Sign out is clicked', async () => {
    mockFetchCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'mike@breachofmind.com',
      displayName: 'Mike',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEventModule.setup();
    const onClose = jest.fn();
    renderMenu(document.body, onClose);

    await screen.findByText('mike@breachofmind.com');
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
