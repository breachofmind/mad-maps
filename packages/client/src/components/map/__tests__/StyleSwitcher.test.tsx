import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { StyleSwitcher } from '../StyleSwitcher';
import { MAP_STYLE_OPTIONS } from '../../../lib/map/mapStyles';

describe('StyleSwitcher', () => {
  it('renders a button for every configured map style', () => {
    render(<StyleSwitcher activeStyleId={MAP_STYLE_OPTIONS[0].id} onChange={() => {}} />);

    for (const option of MAP_STYLE_OPTIONS) {
      expect(screen.getByRole('button', { name: option.label })).toBeInTheDocument();
    }
  });

  it('calls onChange with the selected style id when a different style is clicked', async () => {
    const user = userEventModule.setup();
    const onChange = jest.fn();
    const [first, second] = MAP_STYLE_OPTIONS;

    render(<StyleSwitcher activeStyleId={first.id} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: second.label }));

    expect(onChange).toHaveBeenCalledWith(second.id);
  });

  it('does not call onChange when clicking the already-active style (toggle group returns null)', async () => {
    const user = userEventModule.setup();
    const onChange = jest.fn();
    const [first] = MAP_STYLE_OPTIONS;

    render(<StyleSwitcher activeStyleId={first.id} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: first.label }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('highlights no preset when activeStyleId matches none (a custom style is active)', () => {
    render(<StyleSwitcher activeStyleId="" onChange={() => {}} />);

    for (const option of MAP_STYLE_OPTIONS) {
      expect(screen.getByRole('button', { name: option.label })).toHaveAttribute('aria-pressed', 'false');
    }
  });
});
