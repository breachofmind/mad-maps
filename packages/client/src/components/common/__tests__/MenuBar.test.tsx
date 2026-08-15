import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { MenuBar } from '../MenuBar';

describe('MenuBar', () => {
  it('calls onLogoClick when the logo is clicked', async () => {
    const user = userEventModule.setup();
    const onLogoClick = jest.fn();

    render(<MenuBar onLogoClick={onLogoClick} />);
    await user.click(screen.getByRole('button', { name: 'Back to your maps' }));

    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDownloadClick with the click event when the download icon is clicked', async () => {
    const user = userEventModule.setup();
    const onDownloadClick = jest.fn();

    render(<MenuBar onDownloadClick={onDownloadClick} />);
    await user.click(screen.getByRole('button', { name: 'Export or import map data' }));

    expect(onDownloadClick).toHaveBeenCalledTimes(1);
    expect(onDownloadClick.mock.calls[0][0]).toHaveProperty('currentTarget');
  });

  it('calls onAccountClick with the click event when the account icon is clicked', async () => {
    const user = userEventModule.setup();
    const onAccountClick = jest.fn();

    render(<MenuBar onAccountClick={onAccountClick} />);
    await user.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(onAccountClick).toHaveBeenCalledTimes(1);
    expect(onAccountClick.mock.calls[0][0]).toHaveProperty('currentTarget');
  });

  it('renders without callbacks provided', () => {
    render(<MenuBar />);

    expect(screen.getByRole('button', { name: 'Back to your maps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export or import map data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });
});
