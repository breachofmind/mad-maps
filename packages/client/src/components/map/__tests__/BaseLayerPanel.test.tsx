import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { BaseLayerPanel } from '../BaseLayerPanel';
import { MAP_STYLE_OPTIONS } from '../../../lib/map/mapStyles';

describe('BaseLayerPanel', () => {
  it('shows the active style label', () => {
    render(<BaseLayerPanel activeStyleId={MAP_STYLE_OPTIONS[0].id} onChange={() => {}} onAddCustomStyle={() => {}} />);

    expect(screen.getByText(MAP_STYLE_OPTIONS[0].label)).toBeInTheDocument();
  });

  it('shows "Custom style" when activeStyleId matches no preset', () => {
    render(<BaseLayerPanel activeStyleId="" onChange={() => {}} onAddCustomStyle={() => {}} />);

    expect(screen.getByText('Custom style')).toBeInTheDocument();
  });

  it('calls onChange with the selected style id', async () => {
    const user = userEventModule.setup();
    const onChange = jest.fn();
    const [first, second] = MAP_STYLE_OPTIONS;

    render(<BaseLayerPanel activeStyleId={first.id} onChange={onChange} onAddCustomStyle={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: second.label }));

    expect(onChange).toHaveBeenCalledWith(second.id);
  });

  it('calls onAddCustomStyle when the add icon is clicked', async () => {
    const user = userEventModule.setup();
    const onAddCustomStyle = jest.fn();

    render(<BaseLayerPanel activeStyleId={MAP_STYLE_OPTIONS[0].id} onChange={() => {}} onAddCustomStyle={onAddCustomStyle} />);
    await user.click(screen.getByRole('button', { name: 'Add a custom base style' }));

    expect(onAddCustomStyle).toHaveBeenCalledTimes(1);
  });
});
