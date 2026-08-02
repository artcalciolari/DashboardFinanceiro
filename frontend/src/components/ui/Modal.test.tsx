import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('returns null when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Título">
        Conteúdo
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, focuses first input, locks body scroll', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Nova conta">
        <input aria-label="Campo" />
        <button type="button">Ação</button>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nova conta')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Campo')).toHaveFocus());
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape, overlay click and close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Modal" size="lg">
        <p>Body</p>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    await user.click(screen.getByLabelText('Fechar modal'));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    const overlay = screen.getByRole('presentation');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking dialog content', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Modal" size="sm">
        <p>Body</p>
      </Modal>
    );
    await user.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps focus with Tab and Shift+Tab', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={vi.fn()} title="Trap">
        <button type="button">Primeiro</button>
        <button type="button">Segundo</button>
      </Modal>
    );

    const closeBtn = screen.getByLabelText('Fechar modal');
    const segundo = screen.getByRole('button', { name: 'Segundo' });
    const dialog = screen.getByRole('dialog');

    // Sem input/select/textarea → foco inicial no dialog
    await waitFor(() => expect(dialog).toHaveFocus());

    // DOM order: close → Primeiro → Segundo; Tab from last wraps to first
    segundo.focus();
    await user.tab();
    expect(closeBtn).toHaveFocus();

    // Shift+Tab from first wraps to last
    closeBtn.focus();
    await user.tab({ shift: true });
    expect(segundo).toHaveFocus();

    // Tab from middle does not wrap
    screen.getByRole('button', { name: 'Primeiro' }).focus();
    await user.tab();
    expect(segundo).toHaveFocus();
  });

  it('focuses dialog when no focusable children', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Vazio">
        <span>Só texto</span>
      </Modal>
    );
    // Close button is still focusable; when only close exists Tab trap uses it
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(document.activeElement === dialog || dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('restores previous focus on unmount', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Abrir';
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(
      <Modal isOpen onClose={vi.fn()} title="X">
        <input aria-label="In" />
      </Modal>
    );

    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="X">
        <input aria-label="In" />
      </Modal>
    );

    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it('handles Tab when dialog has no focusable elements by focusing dialog', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={vi.fn()} title="Empty focus">
        texto
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    const spy = vi.spyOn(dialog, 'querySelectorAll').mockReturnValue([] as unknown as NodeListOf<HTMLElement>);

    dialog.focus();
    await user.keyboard('{Tab}');
    expect(dialog).toHaveFocus();
    spy.mockRestore();
  });

  it('stores null previous focus when activeElement is not an HTMLElement', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    document.body.appendChild(svg);
    svg.focus();

    render(
      <Modal isOpen onClose={vi.fn()} title="SVG focus">
        <span>ok</span>
      </Modal>
    );

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    svg.remove();
  });

  it('skips focus when dialog unmounts before rAF', async () => {
    vi.unstubAllGlobals();
    let rafCb: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });

    const { unmount } = render(
      <Modal isOpen onClose={vi.fn()} title="Unmount">
        <input aria-label="Campo" />
      </Modal>
    );

    unmount();
    rafCb?.(0);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
});
