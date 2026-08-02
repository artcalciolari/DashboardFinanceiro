import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorPicker from './ColorPicker';
import { PRESET_COLORS } from '@/utils/formatters';

describe('ColorPicker', () => {
  it('renders label and all presets', () => {
    render(<ColorPicker label="Cor" value={PRESET_COLORS[0]} onChange={vi.fn()} />);
    expect(screen.getByText('Cor')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(PRESET_COLORS.length);
  });

  it('marks selected color and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value={PRESET_COLORS[1]} onChange={onChange} />);

    const selected = screen.getByLabelText(`Selecionar cor ${PRESET_COLORS[1]}`);
    expect(selected).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByLabelText(`Selecionar cor ${PRESET_COLORS[2]}`));
    expect(onChange).toHaveBeenCalledWith(PRESET_COLORS[2]);
  });

  it('renders without label', () => {
    render(<ColorPicker value="#EF4444" onChange={vi.fn()} />);
    expect(screen.queryByText('Cor')).not.toBeInTheDocument();
  });
});
