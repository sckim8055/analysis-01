import React from 'react';
import { useUiStore, type AnalysisStep } from '../../store/uiStore';
import { 
  UploadCloud, Wand2, Link2, GitMerge, 
  Hash, BarChart3, ShieldCheck, TrendingUp, 
  Scale, Layers, LineChart, Network, 
  Settings2, FileText
} from 'lucide-react';
import styles from './Layout.module.css';

const navItems = [
  { id: 'upload', label: '업로드', icon: UploadCloud },
  { id: 'cleansing', label: '클린징', icon: Wand2 },
  { id: 'mapping', label: '매핑', icon: Link2 },
  { id: 'factor', label: '요인분석', icon: BarChart3 },
  { id: 'model', label: '모형설계', icon: GitMerge },
  { divider: true, id: 'd1' },
  { id: 'frequency', label: '빈도분석', icon: Hash },
  { id: 'reliability', label: '신뢰도', icon: ShieldCheck },
  { id: 'correlation', label: '상관관계', icon: TrendingUp },
  { id: 'ttest', label: 'T검정', icon: Scale },
  { id: 'anova', label: 'ANOVA', icon: Layers },
  { id: 'regression', label: '회귀분석', icon: LineChart },
  { id: 'mediation', label: '매개분석', icon: Network },
  { id: 'moderation', label: '조절분석', icon: Settings2 },
  { divider: true, id: 'd2' },
  { id: 'report', label: '전체보고서', icon: FileText },
];

export const LeftNav: React.FC = () => {
  const { currentStep, setCurrentStep } = useUiStore();

  return (
    <nav className={styles.leftNav}>
      {navItems.map((item) => {
        if (item.divider) {
          return <div key={item.id} className={styles.navDivider} />;
        }
        
        const Icon = item.icon!;
        const isActive = currentStep === item.id;
        
        return (
          <div 
            key={item.id}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            onClick={() => setCurrentStep(item.id as AnalysisStep)}
          >
            <Icon className={styles.navIcon} />
            <span className={styles.navLabel}>{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
};
