import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Variable, VarType, FactorSettings } from '../types';

export interface AuditLog {
  id: string;
  timestamp: string;
  step: string;
  action: string;
  details: any;
}

interface AnalysisState {
  // Mapping State
  mappedVars: Record<VarType, Variable[]>;
  setMappedVars: (vars: Record<VarType, Variable[]> | ((prev: Record<VarType, Variable[]>) => Record<VarType, Variable[]>)) => void;

  // Factor Analysis State
  factorSettings: FactorSettings;
  setFactorSettings: (settings: Partial<FactorSettings>) => void;
  
  approvedVariables: string[]; // List of Variable IDs that have been approved in Factor Analysis
  approveVariable: (varId: string) => void;
  resetApproval: (varId: string) => void;
  
  // Store the actual factor analysis results (Optional: can be expanded later)
  factorResults: Record<string, any>; 
  setFactorResult: (varId: string, result: any) => void;

  // Manual Item Exclusion State (per Variable ID)
  excludedItems: Record<string, string[]>;
  toggleItemExclusion: (varId: string, itemId: string) => void;

  // Global trigger for running analysis from Flyout
  triggerFactorAnalysis: number;
  runAnalysisTrigger: () => void;

  // Saved Model Builder State
  savedModelNodes: any[];
  savedModelEdges: any[];
  saveModel: (nodes: any[], edges: any[]) => void;
  
  // Audit Trail & Cache for Full Report
  auditLogs: AuditLog[];
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  
  cachedResults: Record<string, { results: any; settings: any; interpretation: string }>;
  setCachedResult: (step: string, data: { results: any; settings?: any; interpretation?: string }) => void;

  // Reset entire analysis state (e.g. on new file upload)
  resetStore: () => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      mappedVars: {
        iv: [],
        dv: [],
        med: [],
        mod: [],
        gen: [],
      },
      setMappedVars: (vars) => set((state) => ({ 
        mappedVars: typeof vars === 'function' ? vars(state.mappedVars) : vars 
      })),

      factorSettings: {
        extraction: 'pca',
        rotation: 'varimax',
        extractionCriterion: 'eigenvalue',
        eigenvalueThreshold: 1.0,
        fixedFactorCount: 3,
        loading: 0.5,
        communality: 0.4,
        variance: 60,
        kmo: 0.5,
        sortBySize: true,
        hideSmallCoefficients: true,
        smallCoefficientThreshold: 0.4,
      },
      setFactorSettings: (settings) => set((state) => ({
        factorSettings: { ...state.factorSettings, ...settings }
      })),

      approvedVariables: [],
      approveVariable: (varId) => set((state) => ({
        approvedVariables: state.approvedVariables.includes(varId) 
          ? state.approvedVariables 
          : [...state.approvedVariables, varId]
      })),
      resetApproval: (varId) => set((state) => ({
        approvedVariables: state.approvedVariables.filter((id) => id !== varId)
      })),

      factorResults: {},
      setFactorResult: (varId, result) => set((state) => ({
        factorResults: { ...state.factorResults, [varId]: result }
      })),

      excludedItems: {},
      toggleItemExclusion: (varId, itemId) => set((state) => {
        const currentExclusions = state.excludedItems[varId] || [];
        const isExcluded = currentExclusions.includes(itemId);
        return {
          excludedItems: {
            ...state.excludedItems,
            [varId]: isExcluded 
              ? currentExclusions.filter(id => id !== itemId)
              : [...currentExclusions, itemId]
          }
        };
      }),

      triggerFactorAnalysis: 0,
      runAnalysisTrigger: () => set((state) => ({
        triggerFactorAnalysis: state.triggerFactorAnalysis + 1
      })),

      savedModelNodes: [],
      savedModelEdges: [],
      saveModel: (nodes, edges) => set({ savedModelNodes: nodes, savedModelEdges: edges }),
      
      auditLogs: [],
      addAuditLog: (log) => set((state) => ({
        auditLogs: [...state.auditLogs, {
          ...log,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString()
        }]
      })),

      cachedResults: {},
      setCachedResult: (step, data) => set((state) => ({
        cachedResults: {
          ...state.cachedResults,
          [step]: {
            ...state.cachedResults[step],
            ...data
          }
        }
      })),
      
      resetStore: () => set({
        mappedVars: { iv: [], dv: [], med: [], mod: [], gen: [] },
        factorSettings: {
          extraction: 'pca', rotation: 'varimax', extractionCriterion: 'eigenvalue',
          eigenvalueThreshold: 1.0, fixedFactorCount: 3, loading: 0.5, communality: 0.4,
          variance: 60, kmo: 0.5, sortBySize: true, hideSmallCoefficients: true, smallCoefficientThreshold: 0.4,
        },
        approvedVariables: [],
        factorResults: {},
        excludedItems: {},
        triggerFactorAnalysis: 0,
        savedModelNodes: [],
        savedModelEdges: [],
        auditLogs: [],
        cachedResults: {},
      }),
    }),
    {
      name: 'analysis-storage', // localStorage에 저장될 키 이름
    }
  )
);
