/** ゲーム内で共通する問題フォーマット（Dexie / Supabase 両対応） */
export interface GameQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  type: 'vocabulary' | 'grammar';
  explanation?: string | null;
  category?: string;
  vocab_map?: Record<string, string[]>;
}

export type GameMode = 'national' | 'forYou' | 'vocab';
