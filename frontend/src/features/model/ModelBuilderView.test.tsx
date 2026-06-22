import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModelBuilderView } from './ModelBuilderView';
import { ReactFlowProvider } from 'reactflow';

// Mock ResizeObserver for React Flow
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

describe('ModelBuilderView', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ReactFlowProvider>
        <ModelBuilderView />
      </ReactFlowProvider>
    );
    expect(container).toBeDefined();
  });
});
