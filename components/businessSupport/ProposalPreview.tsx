import React, { useState } from 'react';
import { ProposalPresentation, ProposalSource } from '../../types';
import { Button } from './ui/Button';
import ChartRenderer from './charts/ChartRenderer';
import { QuoteIcon } from './icons/QuoteIcon';

interface ProposalPreviewProps {
  presentation: ProposalPresentation;
  sources: ProposalSource[] | null;
  onReset: () => void;
}

const ProposalPreview: React.FC<ProposalPreviewProps> = ({ presentation, sources, onReset }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = presentation.slides[currentSlide];

  const goToNext = () => {
    setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1));
  };

  const goToPrev = () => {
    setCurrentSlide(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className="bg-slate-800/70 border border-slate-700/70 p-6 sm:p-8 rounded-2xl shadow-2xl animate-fade-in text-white space-y-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/80 mb-2">Generated Presentation</p>
        <h2 className="text-3xl font-bold text-cyan-300">{presentation.title}</h2>
        <p className="text-slate-400 mt-2">
          Slide {currentSlide + 1} / {presentation.slides.length}
        </p>
      </div>

      <div className="bg-slate-900/70 p-6 rounded-2xl min-h-[420px] border border-slate-700 space-y-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className={`space-y-4 text-slate-200 ${slide.imageUrl || slide.graph ? 'lg:w-1/2' : 'w-full'}`}>
            <h3 className="text-xl font-semibold text-white">{slide.title}</h3>
            {slide.content.map((point, index) => (
              <p key={`${point}-${index}`} className="text-base leading-relaxed whitespace-pre-wrap">
                {point}
              </p>
            ))}
            {slide.evidence && (
              <div className="mt-4 p-4 bg-cyan-900/30 border-l-4 border-cyan-500 rounded-r-2xl">
                <div className="flex gap-3">
                  <QuoteIcon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-cyan-400">Evidence</h4>
                    <p className="text-sm text-slate-200 mt-1 italic">"{slide.evidence}"</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {(slide.imageUrl || slide.graph) && (
            <div className="lg:w-1/2 space-y-6">
              {slide.imageUrl && (
                <div>
                  <img
                    src={slide.imageUrl}
                    alt={slide.image?.description || 'Generated visual'}
                    className="rounded-xl shadow-lg w-full h-auto object-cover border border-slate-700"
                  />
                </div>
              )}
              {slide.graph && (
                <div className="w-full h-64 bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                  <h4 className="font-semibold text-cyan-300 mb-2">Graph: {slide.graph.dataDescription}</h4>
                  <ChartRenderer graph={slide.graph} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
        <h4 className="font-semibold text-white">Speaker Notes</h4>
        <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{slide.speakerNotes}</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-3">
          <Button onClick={goToPrev} disabled={currentSlide === 0} variant="secondary">
            前へ
          </Button>
          <Button onClick={goToNext} disabled={currentSlide === presentation.slides.length - 1} variant="secondary">
            次へ
          </Button>
        </div>
        <Button onClick={onReset} variant="outline">
          新しい提案書を作成
        </Button>
      </div>

      {sources && sources.length > 0 && (
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-white mb-3">参照ソース</h3>
          <ul className="space-y-2">
            {sources.map(source => (
              <li key={source.uri} className="text-sm">
                <a
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:text-cyan-200 hover:underline underline-offset-2 transition-colors"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProposalPreview;
