import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormError from './FormError';

vi.mock('../../services/api', () => ({
  getApiErrorMessage: () => 'Mensagem de erro',
}));

describe('FormError', () => {
  it('returns null without error', () => {
    const { container } = render(<FormError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders alert with api message', () => {
    render(<FormError error={new Error('x')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Mensagem de erro');
  });
});
