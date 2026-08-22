import { useContext, useEffect } from 'react';
import { BoardDataContext } from './boardDataValueContext';

export function useBoardData() {
  const context = useContext(BoardDataContext);
  const subscribe = context?.subscribe;

  useEffect(() => subscribe?.(), [subscribe]);

  if (!context) {
    throw new Error('useBoardData must be used within BoardDataProvider');
  }
  return context;
}
