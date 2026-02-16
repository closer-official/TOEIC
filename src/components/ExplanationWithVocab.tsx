'use client';

import { motion } from 'framer-motion';

/** vocab_map: 単語 → 意味の配列（TOEIC上位3など） */
type VocabMap = Record<string, string[]>;

interface Props {
  explanation: string | null;
  vocabMap: VocabMap;
  correctOption: string;
  onRegisterWord?: (word: string, meanings: string[]) => void;
  registeredWords?: Set<string>;
}

/** 解説＋Vocab Map の単語をタップで登録（Tap to Register） */
export function ExplanationWithVocab({
  explanation,
  vocabMap,
  correctOption,
  onRegisterWord,
  registeredWords = new Set(),
}: Props) {
  const words = Object.entries(vocabMap);
  const meaningsList = (m: string[]) => (Array.isArray(m) ? m : []).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-600 bg-zinc-900/80 p-4 text-left"
    >
      <p className="font-medium text-green-400">正解: {correctOption}</p>
      {explanation && <p className="mt-1 text-sm text-zinc-400">{explanation}</p>}
      {words.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {words.map(([word, meanings]) => {
            const ms = meaningsList(meanings);
            return (
              <button
                key={word}
                type="button"
                onClick={() => onRegisterWord?.(word, ms)}
                className={`rounded-lg border px-2 py-1 text-sm ${
                  registeredWords.has(word.toLowerCase())
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                    : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-amber-500/50'
                }`}
              >
                <span className="font-medium">{word}</span>
                {ms[0] && <span className="ml-1 text-zinc-500">→ {ms[0]}</span>}
              </button>
            );
          })}
        </div>
      )}
      {onRegisterWord && (
        <p className="mt-2 text-xs text-zinc-500">タップで単語帳に追加 → 単語寿司打で練習</p>
      )}
    </motion.div>
  );
}
