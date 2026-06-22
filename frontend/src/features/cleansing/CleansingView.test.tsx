import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CleansingView } from './CleansingView';

describe('CleansingView', () => {
  it('renders without crashing', () => {
    const { container } = render(<CleansingView />);
    expect(container).toBeDefined();
  });
});
