import { clone, type Composition } from './model';
export type History = { past: Composition[]; present: Composition; future: Composition[] };
export type HistoryAction = { type: 'commit' | 'reset'; value: Composition } | { type: 'undo' | 'redo' };
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'reset') return { past: [], present: action.value, future: [] };
  if (action.type === 'commit') {
    if (JSON.stringify(state.present) === JSON.stringify(action.value)) return state;
    return { past: [...state.past.slice(-39), clone(state.present)], present: clone(action.value), future: [] };
  }
  if (action.type === 'undo' && state.past.length) return { past: state.past.slice(0,-1), present: state.past.at(-1)!, future: [state.present, ...state.future] };
  if (action.type === 'redo' && state.future.length) return { past: [...state.past.slice(-39), state.present], present: state.future[0], future: state.future.slice(1) };
  return state;
}
