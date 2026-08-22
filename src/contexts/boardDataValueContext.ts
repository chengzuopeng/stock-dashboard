import { createContext } from 'react';
import type { ConceptBoard, IndustryBoard } from 'stock-sdk';

export interface BoardDataContextValue {
  industryList: IndustryBoard[];
  conceptList: ConceptBoard[];
  loading: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
  subscribe: () => () => void;
}

export const BoardDataContext = createContext<BoardDataContextValue | null>(null);
