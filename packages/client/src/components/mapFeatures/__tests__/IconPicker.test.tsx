import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { IconPicker } from '../IconPicker';

async function openPicker(user: ReturnType<typeof userEventModule.setup>) {
  await user.click(screen.getByRole('button'));
}

describe('IconPicker', () => {
  it('only offers Maki icon categories, not the old MUI set', async () => {
    const user = userEventModule.setup();
    render(<IconPicker value="marker" onChange={() => {}} />);
    await openPicker(user);

    // "General" is an MUI-only category (icons.ts) — it should no longer appear.
    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(screen.getByText('Symbols & Shapes')).toBeInTheDocument();
    expect(screen.getByText('Food & Drink')).toBeInTheDocument();
  });

  it('search only matches Maki icons', async () => {
    const user = userEventModule.setup();
    render(<IconPicker value="marker" onChange={() => {}} />);
    await openPicker(user);

    await user.type(screen.getByPlaceholderText('Search icons'), 'sushi');
    expect(screen.getByRole('button', { name: 'Restaurant Sushi' })).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search icons'));
    // "flag" only exists in the (now hidden) MUI set, not in Maki.
    await user.type(screen.getByPlaceholderText('Search icons'), 'flag');
    expect(screen.getByText('No icons found')).toBeInTheDocument();
  });

  it('selecting an icon reports its namespaced Maki key', async () => {
    const user = userEventModule.setup();
    const onChange = jest.fn();
    render(<IconPicker value="marker" onChange={onChange} />);
    await openPicker(user);

    await user.type(screen.getByPlaceholderText('Search icons'), 'lighthouse');
    await user.click(screen.getByRole('button', { name: 'Lighthouse' }));

    expect(onChange).toHaveBeenCalledWith('maki:lighthouse');
  });

  it('still displays an already-saved MUI-based icon as the current selection', () => {
    // Old features/layers may still have an MUI-keyed icon (e.g. "restaurant")
    // saved from before Maki was added — it must keep rendering correctly
    // even though it's no longer offered in the picker grid.
    render(<IconPicker value="restaurant" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Restaurant' })).toBeInTheDocument();
  });

  it('falls back to marker when given an unrecognized value', () => {
    render(<IconPicker value="not-a-real-icon" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Marker' })).toBeInTheDocument();
  });
});
