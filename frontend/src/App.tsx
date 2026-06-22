import { MainLayout } from './components/Layout/MainLayout';
import { Workspace } from './features/workspace/Workspace';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <MainLayout>
        <Workspace />
      </MainLayout>
    </ErrorBoundary>
  );
}

export default App;
