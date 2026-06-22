import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FactorAnalysisView } from './FactorAnalysisView';

// Zustand 스토어 모킹 등 필요 시 추가
describe('FactorAnalysisView', () => {
  it('renders without crashing', () => {
    const { container } = render(<FactorAnalysisView />);
    expect(container).toBeDefined();
  });
});
