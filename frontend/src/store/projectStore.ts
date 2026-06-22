import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectData {
  id: string;
  name: string;
  author: string;
  rowCount: number;
  colCount: number;
  lastUpdated: string;
}

interface ProjectState {
  currentProject: ProjectData | null;
  isLoading: boolean;
  originalColumns: string[];
  demographicColumns: string[];
  
  // Actions
  setCurrentProject: (project: ProjectData) => void;
  setLoading: (loading: boolean) => void;
  setOriginalColumns: (columns: string[]) => void;
  setDemographicColumns: (columns: string[]) => void;
  recodeLogs: any[];
  addRecodeLog: (log: any) => void;
  resetProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      isLoading: false,
      originalColumns: [],
      demographicColumns: [],
      
      setCurrentProject: (project) => set({ currentProject: project }),
      setLoading: (loading) => set({ isLoading: loading }),
      setOriginalColumns: (columns) => set({ originalColumns: columns }),
      setDemographicColumns: (columns) => set({ demographicColumns: columns }),
      recodeLogs: [],
      addRecodeLog: (log) => set((state) => ({ recodeLogs: [log, ...state.recodeLogs] })),
      resetProject: () => set({ 
        currentProject: null, 
        originalColumns: [],
        demographicColumns: [],
        recodeLogs: []
      })
    }),
    {
      name: 'project-storage',
    }
  )
);
