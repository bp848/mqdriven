import React from 'react';

interface WordCloudProps {
  words: { text: string; size: number }[];
}

const WordCloud: React.FC<WordCloudProps> = ({ words }) => {
  if (!words.length) return null;

  const maxSize = Math.max(...words.map((w) => w.size));
  const minSize = Math.min(...words.map((w) => w.size));
  const range = Math.max(maxSize - minSize, 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[180px]">
      {words.map((word, index) => {
        const normalized = (word.size - minSize) / range;
        const fontSize = 12 + normalized * 32;
        const opacity = 0.4 + normalized * 0.6;

        return (
          <span
            key={`${word.text}-${index}`}
            style={{ fontSize: `${fontSize}px`, opacity }}
            className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-default select-none"
            title={`出現回数: ${word.size}`}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

export default WordCloud;
