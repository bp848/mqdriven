import { useReducer, useCallback } from 'react';
import { ProposalFormData, ProposalPresentation, ProposalSource } from '../types';
import { generateProposal } from '../services/proposalPresentationService';

type State = {
  status: 'idle' | 'loading' | 'success' | 'error';
  presentation: ProposalPresentation | null;
  sources: ProposalSource[] | null;
  error: string | null;
  actions: string[];
};

type Action =
  | { type: 'GENERATE' }
  | { type: 'ADD_ACTION'; payload: string }
  | { type: 'SUCCESS'; payload: { presentation: ProposalPresentation; sources: ProposalSource[] | null } }
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
      return {
        ...state,
        status: 'success',
        presentation: action.payload.presentation,
        sources: action.payload.sources,
        error: null,
      };
    case 'ERROR':
      return { ...state, status: 'error', error: action.payload, presentation: null, sources: null };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const useProposalGenerator = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const generate = useCallback(async (formData: ProposalFormData) => {
    dispatch({ type: 'GENERATE' });
    const onAction = (message: string) => {
      dispatch({ type: 'ADD_ACTION', payload: message });
    };

    try {
      const result = await generateProposal(formData, onAction);
      dispatch({
        type: 'SUCCESS',
        payload: {
          presentation: result.presentation,
          sources: result.sources ?? null,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      dispatch({ type: 'ERROR', payload: errorMessage });
    }
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, generate, reset };
};

export default useProposalGenerator;
