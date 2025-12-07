
import { useReducer, useCallback } from 'react';
import { generatePresentation } from '../lib/gemini';
import { FormData, Presentation, Source } from '../types';

type State = {
  status: 'idle' | 'loading' | 'success' | 'error';
  presentation: Presentation | null;
  sources: Source[] | null;
  error: string | null;
  actions: string[];
};

type Action =
  | { type: 'GENERATE' }
  | { type: 'ADD_ACTION'; payload: string }
  | { type: 'SUCCESS'; payload: { presentation: Presentation; sources: Source[] | null } }
  | { type: 'ERROR'; payload: string }
  | { type: 'RESET' };

const initialState: State = {
  status: 'idle',
  presentation: null,
  sources: null,
  error: null,
  actions: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GENERATE':
      return { ...initialState, status: 'loading' };
    case 'ADD_ACTION':
      return { ...state, actions: [...state.actions, action.payload] };
    case 'SUCCESS':
      return { ...state, status: 'success', presentation: action.payload.presentation, sources: action.payload.sources, error: null };
    case 'ERROR':
      return { ...state, status: 'error', error: action.payload, presentation: null, sources: null };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const usePresentationGenerator = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const generate = useCallback(async (formData: FormData) => {
    dispatch({ type: 'GENERATE' });
    const onAction = (action: string) => {
      dispatch({ type: 'ADD_ACTION', payload: action });
    };

    try {
      const result = await generatePresentation(formData, onAction);
      dispatch({ type: 'SUCCESS', payload: result });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      dispatch({ type: 'ERROR', payload: errorMessage });
    }
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, generate, reset };
};

export default usePresentationGenerator;
