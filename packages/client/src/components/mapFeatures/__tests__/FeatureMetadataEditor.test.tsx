import { render, screen } from '@testing-library/react';
import userEventModule from '@testing-library/user-event';
import { FeatureMetadataEditor } from '../FeatureMetadataEditor';

describe('FeatureMetadataEditor', () => {
  it('renders existing key/value rows from the metadata prop', () => {
    render(<FeatureMetadataEditor metadata={{ 'asset tag': 'A-4471' }} onCommit={jest.fn()} />);

    expect(screen.getByDisplayValue('asset tag')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A-4471')).toBeInTheDocument();
  });

  it('commits on blur, not on every keystroke', async () => {
    const onCommit = jest.fn();
    const user = userEventModule.setup();
    render(<FeatureMetadataEditor metadata={{ a: '1' }} onCommit={onCommit} />);

    const valueInput = screen.getByDisplayValue('1');
    await user.click(valueInput);
    await user.type(valueInput, '23');
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledWith({ a: '123' });
  });

  it('adds a new row that commits once filled in and blurred', async () => {
    const onCommit = jest.fn();
    const user = userEventModule.setup();
    render(<FeatureMetadataEditor metadata={{}} onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: 'Add metadata' }));
    const keyInput = screen.getByLabelText('Metadata key');
    await user.type(keyInput, 'inspected');
    await user.click(screen.getByLabelText('Metadata value'));
    await user.type(screen.getByLabelText('Metadata value'), '2026-08-01');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith({ inspected: '2026-08-01' });
  });

  it('does not commit an abandoned empty row', async () => {
    const onCommit = jest.fn();
    const user = userEventModule.setup();
    render(<FeatureMetadataEditor metadata={{}} onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: 'Add metadata' }));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('removes a row and commits immediately without needing blur', async () => {
    const onCommit = jest.fn();
    const user = userEventModule.setup();
    render(<FeatureMetadataEditor metadata={{ a: '1', b: '2' }} onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: 'Remove metadata a' }));

    expect(onCommit).toHaveBeenCalledWith({ b: '2' });
  });

  it('shows a duplicate-key error and blocks commit until keys are unique again', async () => {
    const onCommit = jest.fn();
    const user = userEventModule.setup();
    render(<FeatureMetadataEditor metadata={{ a: '1' }} onCommit={onCommit} />);

    await user.click(screen.getByRole('button', { name: 'Add metadata' }));
    const keyInputs = screen.getAllByLabelText('Metadata key');
    await user.type(keyInputs[keyInputs.length - 1], 'a');
    await user.tab();

    expect(await screen.findAllByText('Duplicate key')).toHaveLength(2);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('disables adding more rows once the limit of 50 is reached', () => {
    const metadata = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, 'v']));
    render(<FeatureMetadataEditor metadata={metadata} onCommit={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Add metadata' })).not.toBeInTheDocument();
    expect(screen.getByText('Maximum 50 entries')).toBeInTheDocument();
  });
});
