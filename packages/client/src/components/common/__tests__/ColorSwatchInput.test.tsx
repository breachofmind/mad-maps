import { render, screen, fireEvent } from '@testing-library/react';
import { ColorSwatchInput } from '../ColorSwatchInput';

describe('ColorSwatchInput', () => {
  it('circle variant (default) renders a bare color input with no hex overlay', () => {
    render(<ColorSwatchInput value="#f57c00" onChange={() => {}} ariaLabel="Change color" />);

    expect(screen.getByLabelText('Change color')).toHaveValue('#f57c00');
    expect(screen.queryByText('#F57C00')).not.toBeInTheDocument();
  });

  it('chip variant overlays the uppercased hex value on top of the input', () => {
    render(<ColorSwatchInput variant="chip" value="#f57c00" onChange={() => {}} ariaLabel="Change color" />);

    expect(screen.getByLabelText('Change color')).toHaveValue('#f57c00');
    expect(screen.getByText('#F57C00')).toBeInTheDocument();
  });

  it('calls onChange when the (native color picker) input value changes', () => {
    const onChange = jest.fn();
    render(<ColorSwatchInput variant="chip" value="#f57c00" onChange={onChange} ariaLabel="Change color" />);

    fireEvent.change(screen.getByLabelText('Change color'), { target: { value: '#000000' } });

    expect(onChange).toHaveBeenCalledWith('#000000');
  });
});
