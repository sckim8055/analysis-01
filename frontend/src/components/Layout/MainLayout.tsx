import React from 'react';
import { LeftNav } from './LeftNav';
import { DataCanvasPipeline } from './DataCanvasPipeline';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Settings, User, LogOut } from 'lucide-react';
import styles from './Layout.module.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { currentProject } = useProjectStore();
  const { currentStep } = useUiStore();

  return (
    <div className={styles.mainLayout}>
      {/* Top Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.headerLeft}>
          <span className="text-h2" style={{ color: 'var(--accent-primary)' }}>🔬 Research Analyzer</span>
          <div style={{ height: '24px', width: '1px', background: 'var(--border-color)' }} />
          <span className="text-h3">{currentProject?.name || '프로젝트 없음'} ▼</span>
        </div>
        <div className={styles.headerRight}>
          <span className="text-body" style={{ marginRight: '16px' }}>{currentProject?.author} 연구원</span>
          <button className="btn-icon"><Settings size={20} /></button>
          <button className="btn-icon"><User size={20} /></button>
          <button className="btn-icon"><LogOut size={20} /></button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.contentArea}>
        <LeftNav />
        <main className={styles.canvas} style={{ paddingBottom: ['upload', 'cleansing', 'demographics', 'mapping', 'factor'].includes(currentStep) ? '120px' : '0' }}>
          {children}
        </main>
        
        {['upload', 'cleansing', 'demographics', 'mapping', 'factor'].includes(currentStep) && <DataCanvasPipeline />}
      </div>
    </div>
  );
};
