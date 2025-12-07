
import React from 'react';
import Header from './components/Header';
import PresentationForm from './components/PresentationForm';
import PresentationView from './components/PresentationView';
import { Spinner } from './components/ui/Spinner';
import usePresentationGenerator from './hooks/usePresentationGenerator';
import { FormData } from './types';
import ActionConsole from './components/ActionConsole';

export default function App() {
  const { state, generate, reset } = usePresentationGenerator();
  const { status, presentation, sources, error, actions } = state;

  const handleSubmit = (formData: FormData) => {
    generate(formData);
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <Header />
      <main className="w-full max-w-4xl mt-8">
        {status === 'idle' && <PresentationForm onSubmit={handleSubmit} />}
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 bg-slate-800/50 border border-slate-700/50 rounded-xl shadow-2xl">
            <Spinner />
            <p className="mt-4 text-lg text-slate-300">AI is generating your presentation...</p>
            <p className="mt-2 text-sm text-slate-400">This may take a few moments, especially with images and research.</p>
            <ActionConsole actions={actions} />
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-red-900/20 border border-red-500/30 rounded-lg shadow-lg">
            <p className="text-lg text-red-400">An Error Occurred</p>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <button
              onClick={reset}
              className="mt-6 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
        {status === 'success' && presentation && (
          <PresentationView presentation={presentation} sources={sources} onReset={reset} />
        )}
      </main>
    </div>
  );
}
