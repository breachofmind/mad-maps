import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { MapTitleBar } from '../MapTitleBar';

describe('MapTitleBar', () => {
  it('shows the title as static text until double-clicked', () => {
    render(<MapTitleBar title="My new map" onSubmit={() => {}} />);

    expect(screen.getByText('My new map')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('commits a changed title on Enter', async () => {
    const user = userEventModule.setup();
    const onSubmit = jest.fn();

    render(<MapTitleBar title="My new map" onSubmit={onSubmit} />);
    await user.dblClick(screen.getByText('My new map'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Road trip{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('Road trip');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reverts without submitting on Escape', async () => {
    const user = userEventModule.setup();
    const onSubmit = jest.fn();

    render(<MapTitleBar title="My new map" onSubmit={onSubmit} />);
    await user.dblClick(screen.getByText('My new map'));
    await user.type(screen.getByRole('textbox'), ' extra{Escape}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('My new map')).toBeInTheDocument();
  });

  it('does not submit when the trimmed value is unchanged or empty', async () => {
    const user = userEventModule.setup();
    const onSubmit = jest.fn();

    render(<MapTitleBar title="My new map" onSubmit={onSubmit} />);
    await user.dblClick(screen.getByText('My new map'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '   {Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
