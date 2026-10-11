// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_WIDGET_CLASSES, DEFAULT_WIDGET_STRINGS, FRENCH_WIDGET_STRINGS, Toast } from '../../src/react/index.js';

afterEach(cleanup);

describe('widget defaults', () => {
  it('gives every slot a gc- class and both languages every string', () => {
    for (const value of Object.values(DEFAULT_WIDGET_CLASSES)) expect(value).toMatch(/^gc-/);
    expect(Object.keys(FRENCH_WIDGET_STRINGS).sort()).toEqual(Object.keys(DEFAULT_WIDGET_STRINGS).sort());
    expect(FRENCH_WIDGET_STRINGS.send).toBe('Envoyer');
    expect(DEFAULT_WIDGET_STRINGS.languageLabel).toBe('Language');
  });

  it('renders a toast in the slots it is given', () => {
    render(<Toast message="To be implemented." classNames={{ toastOuter: 'outer', toast: 'inner' }} />);
    const toast = screen.getByText('To be implemented.');
    expect(toast.className).toBe('inner');
    expect(toast.parentElement?.className).toBe('outer');
  });
});
