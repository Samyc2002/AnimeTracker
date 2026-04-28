import { render, fireEvent } from '@testing-library/react';
import SfwToggle from '@/components/SfwToggle';

describe('SfwToggle', () => {
  it('renders SFW highlighted when sfwMode is true', () => {
    const { getByText } = render(<SfwToggle sfwMode={true} onToggle={() => {}} />);
    const sfwLabel = getByText('SFW');
    expect(sfwLabel).toHaveClass('text-emerald-400');
  });

  it('renders NSFW highlighted when sfwMode is false', () => {
    const { getByText } = render(<SfwToggle sfwMode={false} onToggle={() => {}} />);
    const nsfwLabel = getByText('NSFW');
    expect(nsfwLabel).toHaveClass('text-red-400');
  });

  it('renders SFW label dimmed when sfwMode is false', () => {
    const { getByText } = render(<SfwToggle sfwMode={false} onToggle={() => {}} />);
    const sfwLabel = getByText('SFW');
    expect(sfwLabel).toHaveClass('text-gray-600');
  });

  it('renders NSFW label dimmed when sfwMode is true', () => {
    const { getByText } = render(<SfwToggle sfwMode={true} onToggle={() => {}} />);
    const nsfwLabel = getByText('NSFW');
    expect(nsfwLabel).toHaveClass('text-gray-600');
  });

  it('calls onToggle when clicked', () => {
    const handleToggle = vi.fn();
    const { getByRole } = render(<SfwToggle sfwMode={true} onToggle={handleToggle} />);
    fireEvent.click(getByRole('button'));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('shows emerald toggle track when sfwMode is true', () => {
    const { container } = render(<SfwToggle sfwMode={true} onToggle={() => {}} />);
    const track = container.querySelector('.rounded-full.w-10');
    expect(track).toHaveClass('bg-emerald-600');
    expect(track).not.toHaveClass('bg-red-600');
  });

  it('shows red toggle track when sfwMode is false', () => {
    const { container } = render(<SfwToggle sfwMode={false} onToggle={() => {}} />);
    const track = container.querySelector('.rounded-full.w-10');
    expect(track).toHaveClass('bg-red-600');
    expect(track).not.toHaveClass('bg-emerald-600');
  });
});
