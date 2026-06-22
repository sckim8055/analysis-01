import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#121212',
          color: '#ffffff',
          padding: '24px'
        }}>
          <div style={{ 
            padding: '32px', 
            borderRadius: '12px', 
            maxWidth: '600px', 
            textAlign: 'center',
            backgroundColor: '#1e1e1e',
            border: '1px solid #333'
          }}>
            <h1 style={{ color: '#ff4d4f', marginBottom: '16px', fontSize: '1.5rem', fontWeight: 600 }}>화면 렌더링 오류</h1>
            <p style={{ color: '#aaa', marginBottom: '24px', fontSize: '0.95rem' }}>
              컴포넌트를 불러오는 도중 예상치 못한 문제가 발생했습니다.<br/>
              전역 상태나 데이터 구조가 일치하지 않을 수 있습니다.
            </p>
            <div style={{
              backgroundColor: 'rgba(255, 77, 79, 0.1)',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'left',
              overflowX: 'auto',
              marginBottom: '24px',
              color: '#ff4d4f',
              fontFamily: 'monospace',
              fontSize: '0.85rem'
            }}>
              {this.state.error?.toString()}
            </div>
            <button 
              style={{
                backgroundColor: '#4a90e2',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '1rem'
              }}
              onClick={() => window.location.reload()}
            >
              새로고침하여 복구 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
