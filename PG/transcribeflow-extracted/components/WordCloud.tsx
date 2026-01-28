
import React from 'react';

interface WordCloudProps {
  words: { text: string; size: number }[];
}

const WordCloud: React.FC<WordCloudProps> = ({ words }) => {
  if (!words.length) return null;

  // サイズの正規化
  const maxSize = Math.max(...words.map(w => w.size));
  const minSize = Math.min(...words.map(w => w.size));

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 p-8 bg-white rounded-xl shadow-sm border border-slate-100 min-h-[200px]">
      {words.map((word, i) => {
        const fontSize = 12 + ((word.size - minSize) / (maxSize - minSize || 1)) * 32;
        const opacity = 0.4 + ((word.size - minSize) / (maxSize - minSize || 1)) * 0.6;
        
        return (
          <span
            key={i}
            style={{ fontSize: `${fontSize}px`, opacity }}
            className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-default select-none"
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
