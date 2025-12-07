
import React, { useState } from 'react';
import { Presentation, Source } from '../types';
import { Button } from './ui/Button';
import ChartRenderer from './charts/ChartRenderer';
import { QuoteIcon } from './icons/QuoteIcon';

interface PresentationViewProps {
  presentation: Presentation;
  sources: Source[] | null;
  onReset: () => void;
}

const PresentationView: React.FC<PresentationViewProps> = ({ presentation, sources, onReset }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = presentation.slides[currentSlide];

  const goToNext = () => {
    setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1));
  };

  const goToPrev = () => {
    setCurrentSlide(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 p-6 sm:p-8 rounded-xl shadow-2xl animate-fade-in">
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-cyan-400 mb-2">{presentation.title}</h2>
      <div className="text-center text-slate-400 mb-6">
        Slide {currentSlide + 1} of {presentation.slides.length}
      </div>

      <div className="bg-slate-900/70 p-6 rounded-lg min-h-[400px] mb-6 border border-slate-700">
        <h3 className="text-xl font-semibold text-slate-100 mb-4">{slide.title}</h3>
        <div className="flex flex-col lg:flex-row gap-8">
          <div className={`space-y-4 text-slate-300 ${slide.imageUrl || slide.graph ? 'lg:w-1/2' : 'w-full'}`}>
            {slide.content.map((point, index) => (
              <p key={index}>{point}</p>
            ))}
             {slide.evidence && (
              <div className="mt-4 p-4 bg-cyan-900/30 border-l-4 border-cyan-500 rounded-r-lg">
                <div className="flex gap-3">
                  <QuoteIcon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-cyan-400">Evidence</h4>
                    <p className="text-sm text-slate-300 mt-1 italic">"{slide.evidence}"</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="lg:w-1/2 space-y-6">
            {slide.imageUrl && (
              <div>
                <img src={slide.imageUrl} alt={slide.image?.description || 'Generated image'} className="rounded-md shadow-lg w-full h-auto object-cover" />
              </div>
            )}
            {slide.graph && (
              <div className="w-full h-64">
                 <h4 className="font-semibold text-cyan-400 mb-2">Graph: {slide.graph.dataDescription}</h4>
                <ChartRenderer graph={slide.graph} />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-slate-800 rounded-md mb-6">
        <h4 className="font-semibold text-slate-300">Speaker Notes</h4>
        <p className="text-sm text-slate-400 mt-1">{slide.speakerNotes}</p>
      </div>

      <div className="flex justify-between items-center">
        <Button onClick={goToPrev} disabled={currentSlide === 0} variant="secondary">
          Previous
        </Button>
        <Button onClick={goToNext} disabled={currentSlide === presentation.slides.length - 1} variant="secondary">
          Next
        </Button>
      </div>

      {sources && sources.length > 0 && (
        <div className="mt-8 border-t border-slate-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-3">Research Sources</h3>
          <ul className="space-y-2">
            {sources.map((source, index) => (
              <li key={index} className="text-sm">
                <a
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 hover:underline underline-offset-2 transition-colors"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 border-t border-slate-700 pt-6 text-center">
        <Button onClick={onReset} variant="outline">
          Generate New Presentation
        </Button>
      </div>
    </div>
  );
};

export default PresentationView;
