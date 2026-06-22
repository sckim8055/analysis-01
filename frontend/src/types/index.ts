export interface Item {
  id: string;
  name: string;
}

export interface SubFactor {
  id: string;
  name: string;
  itemIds: string[];
}

export interface Variable {
  id: string;
  name: string;
  itemIds: string[];
  subFactors: SubFactor[];
}

export type VarType = 'iv' | 'dv' | 'med' | 'mod' | 'gen';

export interface FactorSettings {
  extraction: 'pca' | 'efa';
  rotation: 'varimax' | 'oblimin';
  extractionCriterion: 'eigenvalue' | 'fixedNumber';
  eigenvalueThreshold: number;
  fixedFactorCount: number;
  loading: number;
  communality: number;
  variance: number;
  kmo: number;
  sortBySize: boolean;
  hideSmallCoefficients: boolean;
  smallCoefficientThreshold: number;
}
