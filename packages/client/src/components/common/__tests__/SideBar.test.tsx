import { render, screen } from '@testing-library/react';
import { SideBar } from '../SideBar';

describe('SideBar', () => {
  it('renders children inside a labeled complementary region', () => {
    render(
      <SideBar>
        <div>Search panel</div>
        <div>Layers panel</div>
      </SideBar>,
    );

    const region = screen.getByRole('complementary', { name: 'Map tools' });
    expect(region).toBeInTheDocument();
    expect(screen.getByText('Search panel')).toBeInTheDocument();
    expect(screen.getByText('Layers panel')).toBeInTheDocument();
  });

  it('renders with no children', () => {
    render(<SideBar />);

    expect(screen.getByRole('complementary', { name: 'Map tools' })).toBeInTheDocument();
  });
});
