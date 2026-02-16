/** Supabase スキーマに合わせた型定義 */

export type Difficulty = '500' | '700' | '900';

/** 単語 → TOEIC頻出意味上位3 */
export type VocabMap = Record<string, [string, string?, string?]>;

export interface QuestionRow {
  id: string;
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string | null;
  difficulty: Difficulty;
  category: string;
  vocab_map: VocabMap;
  created_at: string;
}

export interface UserLogRow {
  id: string;
  user_id: string;
  question_id: string;
  correct: boolean;
  response_time_ms: number;
  category: string;
  created_at: string;
}

export interface UserVocabularyRow {
  id: string;
  user_id: string;
  word: string;
  meanings: string[];
  source_question_id: string | null;
  created_at: string;
}

/** 弱点分析: カテゴリ別正解率 */
export interface CategoryAccuracy {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}
