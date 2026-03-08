'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { db, type Word, type WordProgress } from '@/lib/db';
import { onCorrect, onMiss, getIntervalForStage } from '@/lib/ebbinghaus';
import { seedIfEmpty } from '@/lib/seed';
import { createClient } from '@/lib/supabase/client';

/** user_logs は question_id が UUID（questions テーブル参照）のときのみ保存可能 */
function isValidQuestionIdForLog(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
import { StaminaModal } from '@/components/StaminaModal';
import type { GameQuestion, GameMode } from '@/types/game';
import {
  type SurvivalRank,
  INITIAL_SURVIVAL_SEC,
  MAX_SURVIVAL_SEC,
  CORRECT_ADD_SEC,
  COMBO_BONUS_SEC,
  COMBO_BONUS_INTERVAL,
  WRONG_PENALTY_SEC,
  WRONG_SCORE_PENALTY_RATIO,
  SKIP_PENALTY_SEC,
  STUN_DURATION_MS,
  FEVER_ENTRY_COMBO,
  FEVER_DURATION_SEC,
  getBarDurationMs,
} from '@/lib/survival';
import {
  rarityFromDifficulty,
  RARITY_BASE_POINTS,
  scorePerQuestion,
  comboMultiplier,
  speedBonus,
  getShunRank,
  type ShunRank,
} from '@/lib/shun-score';
import {
  correctTimeMultiplier,
  scoreMultiplier,
  wrongPenaltyMultiplier,
} from '@/lib/evolution';
import { playSoundIfExists, playBgmIfExists, stopBgm } from '@/lib/game-audio';
import {
  getRandomQuestionsFromWindow,
  buildRefillBatch,
  getFeverQuestions,
  WINDOW_INITIAL,
  WINDOW_EXPAND_STEP,
  VOCAB_REFILL_THRESHOLD,
  VOCAB_REFILL_BATCH_SIZE,
  FEVER_QUESTIONS_COUNT,
  inferPosFromMeaning,
} from '@/lib/vocab-window';
import { getEquipmentEffects, getEquipmentEffectSources, type EquippedState, type EquipmentEffects, type EffectSource } from '@/lib/equipment-effects';
import { STAMINA_CONSUME_OPTIONS, getXpMultiplierForStamina } from '@/lib/stamina';
import { GACHA_EQUIPMENT, formatEffectDescription } from '@/lib/equipment-items';
import { getItemEffects, type ItemEffects } from '@/lib/item-effects';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { useOffline } from '@/lib/offline-context';
import { getVocabCache, getPart5Cache, addPendingRun } from '@/lib/offline-db';

const VOCAB_TIMEOUT_MS = 5000;
const GRAMMAR_TIMEOUT_MS = 10000;
const TICK_MS = 100;
/** 最大プレイ時間（経過で強制終了）。単語3分・Part5は5分 */
const MAX_GAME_DURATION_VOCAB_MS = 3 * 60 * 1000;
const MAX_GAME_DURATION_PART5_MS = 5 * 60 * 1000;

function GamePageInner() {
  const searchParams = useSearchParams();
  return <GameContent key={searchParams.toString()} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" /><LoadingWithPercent className="text-white" /></div>}>
      <GamePageInner />
    </Suspense>
  );
}

function toGameQuestion(w: Word): GameQuestion {
  return {
    id: w.id,
    question: w.question,
    options: w.options,
    correctIndex: w.correctIndex,
    type: w.type,
  };
}

const VOCAB_PLACEHOLDERS = ['（該当なし）', '（不明）', '（×）'] as const;

type VocabEntry = { word: string; pos?: string; meanings?: string[]; dummies?: string[] };

/** 旧データ・global_vocabulary 混在対策: 品詞表記を除去して表示を統一（品詞は表示しない仕様） */
function stripPosForDisplay(s: string): string {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  // 語の末尾の (動)(名)(動詞)(名詞)(形容詞)(副詞)(接続詞)(前置詞)(助動詞) など
  t = t.replace(/\s*[（(][動名形副接前助]詞?[）)]\s*$/g, '').trim();
  t = t.replace(/\s*[（(](形容詞|副詞|接続詞|前置詞|助動詞|動詞|名詞)[）)]\s*$/g, '').trim();
  // 意味の先頭の 「動 」「名 」「動詞 」「名詞 」 など
  t = t.replace(/^(動詞|名詞|形容詞|副詞|接続詞|前置詞|助動詞)\s+/, '').trim();
  t = t.replace(/^[動名形副接前助]\s+/, '').trim();
  return t;
}

const BAD_VOTES_THRESHOLD = 5;

/** 単語ごとの選択肢統計（誤答率トップ3・悪問除外で使う） */
type VocabChoiceStats = { text: string; wrongSelectedCount: number; badVotes: number }[];

/** 1単語1問。vocab.json 形式（meaning+dummies）のときは正答＝意味・誤答＝ダミーから3つ。問題文は「単語[品詞]」で表示。 */
function vocabListToQuestions(
  list: VocabEntry[],
  shuffle: <T>(arr: T[]) => T[],
  statsByWord?: Record<string, VocabChoiceStats>
): GameQuestion[] {
  const cards: { word: string; pos?: string; meaning: string; dummies?: string[] }[] = [];
  for (const v of list) {
    const raw = Array.isArray(v.meanings) && v.meanings.length > 0 ? v.meanings : [v.word];
    const normalized = raw.map((m) => stripPosForDisplay(String(m ?? '').trim())).filter(Boolean);
    const unique = [...new Set(normalized)] as string[];
    if (unique.length === 0) continue;
    const meaning = unique[Math.floor(Math.random() * unique.length)]!;
    const word = stripPosForDisplay(String(v.word ?? '').trim());
    if (!word) continue;
    const pos = typeof v.pos === 'string' ? v.pos.trim() : undefined;
    const dummies = Array.isArray(v.dummies) && v.dummies.length >= 3
      ? v.dummies.map((d) => stripPosForDisplay(String(d).trim())).filter(Boolean)
      : undefined;
    cards.push({ word, pos, meaning, dummies });
  }
  const byPos = new Map<string, string[]>();
  for (const c of cards) {
    const p = inferPosFromMeaning(c.meaning);
    if (!byPos.has(p)) byPos.set(p, []);
    byPos.get(p)!.push(c.meaning);
  }
  const shuffledCards = shuffle([...cards]);
  return shuffledCards.map((card, i) => {
    let wrongs: string[];
    if (card.dummies && card.dummies.length >= 3) {
      wrongs = shuffle([...card.dummies]).slice(0, 3);
    } else {
      const samePos = inferPosFromMeaning(card.meaning);
      const samePosMeanings = [...new Set(byPos.get(samePos) ?? [])].filter((m) => m !== card.meaning);
      const stats = statsByWord?.[card.word];
      if (stats && samePosMeanings.length > 0) {
        const withStats = samePosMeanings
          .map((text) => {
            const s = stats.find((x) => x.text === text);
            return { text, wrongSelectedCount: s?.wrongSelectedCount ?? 0, badVotes: s?.badVotes ?? 0 };
          })
          .filter((x) => x.badVotes < BAD_VOTES_THRESHOLD);
        const sorted = [...withStats].sort((a, b) => b.wrongSelectedCount - a.wrongSelectedCount);
        wrongs = shuffle(sorted.slice(0, 3).map((x) => x.text));
        while (wrongs.length < 3) {
          const rest = samePosMeanings.filter((m) => !wrongs.includes(m));
          wrongs.push(rest[Math.floor(Math.random() * rest.length)] ?? VOCAB_PLACEHOLDERS[wrongs.length] ?? `（選択肢${wrongs.length + 1}）`);
        }
      } else {
        wrongs = shuffle([...samePosMeanings]).slice(0, 3);
      }
    }
    let pi = 0;
    while (wrongs.length < 3) {
      wrongs.push(VOCAB_PLACEHOLDERS[pi] ?? `（選択肢${pi + 1}）`);
      pi++;
    }
    const fourOptions = shuffle([card.meaning, ...wrongs]) as [string, string, string, string];
    const correctIndex = fourOptions.indexOf(card.meaning);
    const questionText = card.pos ? `${card.word} [${card.pos}]` : card.word;
    return {
      id: `vocab-${card.word}-${i}-${card.meaning.slice(0, 8)}`,
      question: questionText,
      options: fourOptions,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      type: 'vocabulary' as const,
    };
  });
}

function supabaseToGameQuestion(q: {
  id: string;
  question: string;
  options: string[] | [string, string, string, string];
  correct_index: number;
  explanation?: string | null;
  category?: string;
  difficulty?: string;
  vocab_map?: Record<string, string[] | [string, string?, string?]>;
}): GameQuestion {
  const opts = Array.isArray(q.options) && q.options.length >= 4
    ? [q.options[0], q.options[1], q.options[2], q.options[3]] as [string, string, string, string]
    : (['', '', '', ''] as [string, string, string, string]);
  const vm = q.vocab_map ?? {};
  const vocabMap: Record<string, string[]> = {};
  Object.entries(vm).forEach(([k, v]) => {
    vocabMap[k] = Array.isArray(v) ? v.filter(Boolean) as string[] : [];
  });
  return {
    id: q.id,
    question: q.question,
    options: opts,
    correctIndex: q.correct_index,
    type: 'grammar',
    explanation: q.explanation ?? null,
    category: q.category,
    difficulty: q.difficulty,
    vocab_map: Object.keys(vocabMap).length ? vocabMap : undefined,
  };
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOffline, effectiveOfflineStamina } = useOffline();
  const modeFromUrl = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('mode') as GameMode) : null;
  const mode: GameMode = (searchParams.get('mode') as GameMode) ?? modeFromUrl ?? 'part5-national';
  const isTournamentMode = mode === 'part5-tournament' || mode === 'vocab-tournament';

  const [queue, setQueue] = useState<GameQuestion[]>([]);
  const [isSupabaseQueue, setIsSupabaseQueue] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [showStaminaModal, setShowStaminaModal] = useState(false);
  const [nextRecoveryAt, setNextRecoveryAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  /** ゲーム開始前: 消費スタミナ量選択（5〜25）。null で非表示 */
  const [showStaminaAmountSelect, setShowStaminaAmountSelect] = useState(false);
  const [staminaAmountToConsume, setStaminaAmountToConsume] = useState(5);
  const [currentStaminaForSelect, setCurrentStaminaForSelect] = useState<number | null>(null);
  const staminaConsumeRef = useRef(5);
  const [showSummary, setShowSummary] = useState(false);
  const evolutionExpAddedRef = useRef(false);
  const scoreRef = useRef(0);
  const resultsRef = useRef<{ question: GameQuestion; userChoiceIndex: number; correct: boolean }[]>([]);
  const [results, setResults] = useState<{ question: GameQuestion; userChoiceIndex: number; correct: boolean }[]>([]);
  const [registeredWords, setRegisteredWords] = useState<Set<string>>(new Set());
  const [badQuestionSent, setBadQuestionSent] = useState<Set<string>>(new Set());
  // 語彙スライディングウィンドウ・リベンジ・フィーバー用
  const fullVocabListRef = useRef<VocabEntry[] | null>(null);
  const [windowEnd, setWindowEnd] = useState(WINDOW_INITIAL);
  const windowEndRef = useRef(WINDOW_INITIAL);
  const [revengeStack, setRevengeStack] = useState<GameQuestion[]>([]);
  const revengeStackRef = useRef<GameQuestion[]>([]);
  const [feverQuestions, setFeverQuestions] = useState<GameQuestion[]>([]);
  const [feverQuestionIndex, setFeverQuestionIndex] = useState(0);
  const seenInSessionRef = useRef<Set<string>>(new Set());
  const questionStartMsRef = useRef(Date.now());
  const totalTimeMsRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const currentIndexRef = useRef(0);

  // サバイバル・クロック
  const [rank, setRank] = useState<SurvivalRank | null>(null);
  const [survivalTimeSec, setSurvivalTimeSec] = useState(INITIAL_SURVIVAL_SEC);
  const [score, setScore] = useState(0);
  const [isFever, setIsFever] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [stunned, setStunned] = useState(false);
  const [barProgress, setBarProgress] = useState(0);
  const [comboPopup, setComboPopup] = useState<5 | 10 | null>(null);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [perfectBonusActive, setPerfectBonusActive] = useState(false);
  const [isBossQuestion, setIsBossQuestion] = useState(false);
  const [bossWarningShown, setBossWarningShown] = useState(false);
  const [timeStopUntil, setTimeStopUntil] = useState(0);
  const [ghostRemainingSec, setGhostRemainingSec] = useState<number | null>(null);
  const [ghostCheckpoints, setGhostCheckpoints] = useState<{ q: number; t: number; remainingSec: number }[]>([]);
  const [bossQuestion, setBossQuestion] = useState<GameQuestion | null>(null);
  const feverEndTimeRef = useRef(0);
  const stunUntilRef = useRef(0);
  const barStartTimeRef = useRef(Date.now());
  const survivalTimeRef = useRef(INITIAL_SURVIVAL_SEC);
  const comboRef = useRef(0);
  const isFeverRef = useRef(false);
  const rankRef = useRef<SurvivalRank | null>(null);
  const onSkipRef = useRef<(() => void) | null>(null);
  const answeredRef = useRef(false);
  const maxComboRef = useRef(0);
  /** 解答後〜次問表示までの間はタイマー・バーを止める（この時刻まで経過させない） */
  const transitionEndRef = useRef(0);
  const lastBossAtMsRef = useRef(0);
  const bossQuestionRef = useRef<GameQuestion | null>(null);
  const timeStopUntilRef = useRef(0);
  const checkpointsRef = useRef<{ q: number; t: number; remainingSec: number }[]>([]);
  const ghostCheckpointsRef = useRef<{ q: number; t: number; remainingSec: number }[]>([]);
  const vocabWrongWordsRegisteredRef = useRef(false);
  /** ゲーム開始した実時刻（単語3分・Part5は5分で強制終了用） */
  const gameStartMsRef = useRef<number | null>(null);
  const [forYouCountdown, setForYouCountdown] = useState<number | null>(null);
  /** ランク選択後の3秒カウント（全国・Part5 For You 用） */
  const [countdownBeforeStart, setCountdownBeforeStart] = useState<number | null>(null);
  const [selectedRank, setSelectedRank] = useState<SurvivalRank | null>(null);
  /** 初回ルール説明モーダル（null=未判定, true=表示, false=スキップ済） */
  const [showRuleModal, setShowRuleModal] = useState<boolean | null>(null);
  /** BOSS 終了後の誤タップ防止クールダウン（1.5秒） */
  const [postBossCooldown, setPostBossCooldown] = useState(false);
  /** ルールモーダル「次回からスキップ」チェック */
  const [ruleSkipNext, setRuleSkipNext] = useState(false);
  const keyBindingsRef = useRef<{ topLeft: string; bottomLeft: string; topRight: string; bottomRight: string } | null>(null);
  const evolutionRef = useRef<{
    correct_time: number;
    score: number;
    wrong_penalty: number;
    torso?: number;
    seasonCarry?: { correct_time: number; score: number; wrong_penalty: number };
    guildScoreBonus?: number;
  }>({ correct_time: 0, score: 0, wrong_penalty: 0 });
  /** コンボガード（不正解時減少軽減Lv10）: 1プレイにつき1回だけミスでコンボ維持 */
  const comboGuardUsedRef = useRef(false);
  /** 装備効果（装着情報から算出）。ゲーム中は変更しない */
  const equipmentEffectsRef = useRef<EquipmentEffects>({});
  /** 効果キー→装備出所（発動時ポップアップ用） */
  const effectSourcesRef = useRef<Record<string, EffectSource>>({});
  /** 装着状態（プレイ終了後の詳細表示用） */
  const equippedRef = useRef<EquippedState>({ weapon: null, head: null, torso: null, feet: null });
  /** プレイ中に装備効果ごとに記録した発動・寄与（結果画面で「今回のプレイで」表示） */
  const equipmentPlayStatsRef = useRef<EquipmentPlayStats>({});
  /** 黄金のシーリングスタンプ（スコア加算率）による基礎スコア増分の累計（ビフォアアフター表示用） */
  const scoreAddRateBonusRef = useRef(0);
  /** 追撃のヒール（開始時バフ）による基礎スコア増分の累計（ビフォアアフター表示用） */
  const evolutionBuffBonusRef = useRef(0);
  /** 効果発動時に一瞬表示する装備（GREAT/EXCELLENT と同じ位置） */
  const [effectTriggerPopup, setEffectTriggerPopup] = useState<EffectSource | null>(null);
  /** 連鎖の万年筆: 次の1問のみスコア・XP倍率適用 */
  const rensaNextQuestionRef = useRef(false);
  /** 土俵際のブレザー: 0秒時1回だけ時間停止を使用したか */
  const lastStandUsedRef = useRef(false);
  /** 栄光のタキシード: 10問ごとの蓄積加算スタック数（0〜10） */
  const gloryStacksRef = useRef(0);
  /** 成長のドレス: 10問ごとのXP倍率加算スタック数（0〜10） */
  const growthStacksRef = useRef(0);
  /** 成長スタックなしの場合のスコア合計（熟練の蛍光マーカー等のXP寄与を結果表示用に算出） */
  const scoreWithoutGrowthRef = useRef(0);
  /** 追撃のヒール: 進化バフが有効な終了時刻（ms）。開始30秒間をバフとする */
  const evolutionBuffEndMsRef = useRef(0);
  /** 進化バフ発動ポップアップを1プレイで1回だけ表示したか */
  const evolutionBuffPopupShownRef = useRef(false);
  /** ランキング記録をこのプレイで送信済みか（ゲームオーバー時に1回だけ送るため） */
  const runRecordedRef = useRef(false);
  /** 60秒区切り用（洞察・預言・韋駄天・英知）。最後に処理した境界の実経過ms */
  const lastTick60MsRef = useRef(0);
  /** 15秒区切り用（維持のソックス） */
  const lastTick15MsRef = useRef(0);
  /** 直近1分間の正解数（英知のヘッドセット用）。ゲーム開始から0〜1分、1〜2分…の各区間で加算し、60秒経過時にボーナス付与後にリセット */
  const correctInMinuteRef = useRef(0);
  /** アイテム効果（所持アイテムから算出） */
  const itemEffectsRef = useRef<ItemEffects>({});
  const effectTriggerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showEffectTrigger = useCallback((key: string) => {
    const s = effectSourcesRef.current[key];
    if (!s) return;
    if (effectTriggerTimeoutRef.current) clearTimeout(effectTriggerTimeoutRef.current);
    setEffectTriggerPopup(s);
    effectTriggerTimeoutRef.current = setTimeout(() => {
      setEffectTriggerPopup(null);
      effectTriggerTimeoutRef.current = null;
    }, 700);
  }, []);
  const showEffectTriggerRef = useRef(showEffectTrigger);
  showEffectTriggerRef.current = showEffectTrigger;
  /** 回復の秘薬: 1回だけミス無効化を使用したか */
  const potionGuardUsedRef = useRef(false);
  /** 不死鳥の羽根: タイムオーバー復活を1回使用したか */
  const phoenixUsedRef = useRef(false);

  // refs 同期
  survivalTimeRef.current = survivalTimeSec;
  comboRef.current = combo;
  isFeverRef.current = isFever;
  rankRef.current = rank;
  answeredRef.current = answered;
  currentIndexRef.current = currentIndex;
  scoreRef.current = score;
  resultsRef.current = results;

  useEffect(() => {
    questionStartMsRef.current = Date.now();
    barStartTimeRef.current = Date.now();
  }, [currentIndex]);

  // ゴースト: 同一モード・ランクの自己ベストの checkpoints を取得
  useEffect(() => {
    if (!rank || !(mode === 'part5-national' || mode === 'vocab-national')) return;
    const modeKey = mode.startsWith('vocab') ? 'vocab' : 'part5';
    fetch(`/api/my-best-run?mode=${modeKey}&rank=${rank}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = data?.run?.checkpoints ?? [];
        ghostCheckpointsRef.current = list;
        setGhostCheckpoints(list);
      })
      .catch(() => {});
  }, [rank, mode]);

  // ゴーストの現在位置: この問題開始時点の自己ベスト残り時間
  useEffect(() => {
    if (ghostCheckpoints.length === 0) {
      setGhostRemainingSec(null);
      return;
    }
    const idx = currentIndex;
    const rem = idx === 0 ? MAX_SURVIVAL_SEC : ghostCheckpoints[idx - 1]?.remainingSec ?? null;
    setGhostRemainingSec(rem);
  }, [currentIndex, ghostCheckpoints]);

  // 進化状態の取得（全国・大会モードでランク選択後）。研鑽の極意→正解時加算秒数、至高の技巧→スコア倍率、魂の燃焼→誤答ペナルティに反映
  useEffect(() => {
    if (!rank || (mode !== 'part5-national' && mode !== 'vocab-national' && mode !== 'vocab-word-national' && mode !== 'part5-tournament' && mode !== 'vocab-tournament')) return;
    fetch('/api/evolution')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.branches) {
          evolutionRef.current = {
            ...d.branches,
            seasonCarry: d.seasonCarry ?? { correct_time: 0, score: 0, wrong_penalty: 0 },
            guildScoreBonus: typeof d.guildScoreBonus === 'number' ? d.guildScoreBonus : 0,
          };
        }
      })
      .catch(() => {});
  }, [rank, mode]);

  // 装備・アイテム効果の取得（ランク確定＝プレイ開始時に1回）。大会モード含む
  useEffect(() => {
    if (!rank) return;
    const applyInitialItemTime = (itemEffects: ItemEffects) => {
      const add = itemEffects.initial_time_add_sec ?? 0;
      if (add > 0) {
        setSurvivalTimeSec((s) => {
          const next = Math.min(MAX_SURVIVAL_SEC, s + add);
          survivalTimeRef.current = next;
          return next;
        });
      }
    };
    Promise.all([
      fetch('/api/equipment', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/inventory', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([equipData, invData]) => {
        const equipped: EquippedState = {
          weapon: equipData?.equipped?.weapon ? { equipment_id: equipData.equipped.weapon.equipment_id, grade: equipData.equipped.weapon.grade, level: equipData.equipped.weapon.level ?? 0, effect_base: equipData.equipped.weapon.effect_base ?? 1 } : null,
          head: equipData?.equipped?.head ? { equipment_id: equipData.equipped.head.equipment_id, grade: equipData.equipped.head.grade, level: equipData.equipped.head.level ?? 0, effect_base: equipData.equipped.head.effect_base ?? 1 } : null,
          torso: equipData?.equipped?.torso ? { equipment_id: equipData.equipped.torso.equipment_id, grade: equipData.equipped.torso.grade, level: equipData.equipped.torso.level ?? 0, effect_base: equipData.equipped.torso.effect_base ?? 1 } : null,
          feet: equipData?.equipped?.feet ? { equipment_id: equipData.equipped.feet.equipment_id, grade: equipData.equipped.feet.grade, level: equipData.equipped.feet.level ?? 0, effect_base: equipData.equipped.feet.effect_base ?? 1 } : null,
        };
        equippedRef.current = equipped;
        equipmentEffectsRef.current = getEquipmentEffects(equipped);
        effectSourcesRef.current = getEquipmentEffectSources(equipped) as Record<string, EffectSource>;
        equipmentPlayStatsRef.current = {};
        scoreAddRateBonusRef.current = 0;
        evolutionBuffBonusRef.current = 0;
        const rawItems = (invData?.items ?? []) as { id: string }[];
        const ownedItemIds = [...new Set(rawItems.map((it) => it.id).filter(Boolean))] as string[];
        itemEffectsRef.current = getItemEffects(ownedItemIds);
        rensaNextQuestionRef.current = false;
        lastStandUsedRef.current = false;
        gloryStacksRef.current = 0;
        growthStacksRef.current = 0;
        scoreWithoutGrowthRef.current = 0;
        potionGuardUsedRef.current = false;
        phoenixUsedRef.current = false;
        evolutionBuffPopupShownRef.current = false;
        const startMs = gameStartMsRef.current ?? Date.now();
        evolutionBuffEndMsRef.current = startMs + (equipmentEffectsRef.current.evolution_buff_sec ?? 30) * 1000;
        lastTick60MsRef.current = 0;
        lastTick15MsRef.current = 0;
        correctInMinuteRef.current = 0;
        applyInitialItemTime(itemEffectsRef.current);
      })
      .catch(() => {
        equipmentEffectsRef.current = {};
        itemEffectsRef.current = {};
      });
  }, [rank]);

  // BGM: 残り5秒でurgent、FEVERでfever、それ以外はnormal（ファイルがあれば再生）
  useEffect(() => {
    if (!rank || gameOver) {
      stopBgm();
      return;
    }
    if (isFever) playBgmIfExists('bgmFever');
    else if (survivalTimeSec <= 5) playBgmIfExists('bgmUrgent');
    else playBgmIfExists('bgmNormal');
  }, [rank, gameOver, isFever, survivalTimeSec]);

  // サバイバル系モードで初回のみルール説明を表示するか（localStorage でスキップ済みなら表示しない）
  const isSurvivalMode =
    mode === 'part5-national' || mode === 'vocab-national' || mode === 'vocab-word-national' || mode === 'part5-forYou' || mode === 'vocab-forYou' || mode === 'part5-tournament' || mode === 'vocab-tournament';
  useEffect(() => {
    if (!isSurvivalMode || queue.length === 0) return;
    if (showRuleModal !== null) return;
    const skip = typeof window !== 'undefined' && window.localStorage.getItem('closer_rule_modal_skip') === '1';
    setShowRuleModal(!skip);
  }, [isSurvivalMode, queue.length, showRuleModal]);

  // 全国・大会モード：ランク選択を廃止し、プレイ開始でいきなり3秒カウント（60秒モードのみ）。ルールモーダル未解除または表示中は開始しない
  useEffect(() => {
    if (showRuleModal !== false) return;
    if (mode !== 'part5-national' && mode !== 'vocab-national' && mode !== 'vocab-word-national' && mode !== 'part5-tournament' && mode !== 'vocab-tournament') return;
    if (queue.length === 0 || rank !== null) return;
    setSelectedRank('ACE');
    setCountdownBeforeStart(3);
  }, [mode, queue.length, rank, showRuleModal]);

  // For You: 3-2-1 カウント後に即開始（60秒モードで ACE 扱い）。ルールモーダル未解除または表示中は開始しない
  useEffect(() => {
    if (showRuleModal !== false) return;
    if (mode !== 'vocab-forYou' || queue.length === 0 || rank !== null || !queue[0]) return;
    if (forYouCountdown === null) {
      setForYouCountdown(3);
      return;
    }
    if (forYouCountdown === 0) {
      gameStartMsRef.current = Date.now();
      setRank('ACE');
      rankRef.current = 'ACE';
      setSurvivalTimeSec(INITIAL_SURVIVAL_SEC);
      survivalTimeRef.current = INITIAL_SURVIVAL_SEC;
      barStartTimeRef.current = Date.now();
      comboGuardUsedRef.current = false;
      setForYouCountdown(null);
      return;
    }
    const t = setTimeout(() => setForYouCountdown((n) => (n == null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [mode, queue.length, rank, forYouCountdown, showRuleModal]);

  // ランク選択後の3秒カウント（全国・Part5 For You）：3→2→1→開始
  useEffect(() => {
    if (selectedRank === null || countdownBeforeStart === null) return;
    if (countdownBeforeStart === 0) {
      gameStartMsRef.current = Date.now();
      setRank(selectedRank);
      rankRef.current = selectedRank;
      setSurvivalTimeSec(INITIAL_SURVIVAL_SEC);
      survivalTimeRef.current = INITIAL_SURVIVAL_SEC;
      barStartTimeRef.current = Date.now();
      comboGuardUsedRef.current = false; // プレイ開始時にコンボガードをリセット
      setSelectedRank(null);
      setCountdownBeforeStart(null);
      return;
    }
    const t = setTimeout(() => setCountdownBeforeStart((n) => (n == null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [selectedRank, countdownBeforeStart]);

  // 見送り用に現在問題を ref で保持
  const currentQuestionRef = useRef<GameQuestion | null>(null);
  currentIndexRef.current = currentIndex;
  windowEndRef.current = windowEnd;
  revengeStackRef.current = revengeStack;
  const showingFeverQuestion =
    mode === 'vocab-national' &&
    isFever &&
    feverQuestions.length > 0 &&
    feverQuestionIndex < feverQuestions.length;
  const displayQuestionRaw = isBossQuestion ? bossQuestion : queue[currentIndex];
  const displayQuestion = showingFeverQuestion ? feverQuestions[feverQuestionIndex]! : displayQuestionRaw;
  currentQuestionRef.current = displayQuestion ?? queue[currentIndex] ?? null;
  const current = displayQuestion ?? queue[currentIndex];

  // 全国モード: ランキング用 run を1回だけ送信。大会モード: 大会用 submit のみ（スタミナ・XP・通常ランキングなし）
  useEffect(() => {
    if (!gameOver || runRecordedRef.current) return;
    const totalCorrect = results.filter((r) => r.correct).length;
    const finalBonus = (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * totalCorrect;
    const baseScore = rank != null ? score + finalBonus : totalCorrect;
    const scoreToSave = rank != null ? Math.round(baseScore) : baseScore;
    const totalMs = typeof totalTimeMsRef.current === 'number' && Number.isFinite(totalTimeMsRef.current) ? totalTimeMsRef.current : 0;

    if (isTournamentMode) {
      runRecordedRef.current = true;
      const slot = mode === 'part5-tournament' ? 'part5' : 'vocab';
      createClient()
        .auth.getSession()
        .then(({ data: { session } }) => {
          if (!session?.user?.id) {
            runRecordedRef.current = false;
            return;
          }
          fetch('/api/tournament/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              slot,
              score: scoreToSave,
              totalTimeMs: totalMs,
              run_question_ids: mode === 'part5-tournament' && queue.length > 0 ? queue.map((q) => q.id) : undefined,
            }),
          })
            .then((res) => res.json().catch(() => ({})))
            .then((data) => {
              if (data?.error) console.warn('[tournament submit]', data);
            });
        });
      return;
    }

    if (mode !== 'part5-national' && mode !== 'vocab-national' && mode !== 'vocab-word-national') return;
    const modeKey = mode.startsWith('vocab') ? 'vocab' : 'part5';
    const survivalRank = rank ?? 'ACE';
    const correctCount = resultsRef.current.filter((r) => r.correct).length;
    const finalBonusGo = (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * correctCount;
    const baseScoreGo = rank != null ? scoreRef.current + finalBonusGo : correctCount;
    const scoreToShow = rank != null ? Math.round(baseScoreGo) : baseScoreGo;
    const epMult = 1 + (itemEffectsRef.current.ep_pct ?? 0) / 100;
    const staminaAmount = staminaConsumeRef.current ?? 5;

    runRecordedRef.current = true;
    if (isOffline) {
      addPendingRun({
        id: crypto.randomUUID(),
        score: scoreToSave,
        totalTimeMs: totalMs,
        game_mode: modeKey,
        staminaAmount,
        survival_rank: survivalRank,
        checkpoints: checkpointsRef.current?.length ? checkpointsRef.current : undefined,
        question_ids: mode === 'part5-national' && queue.length > 0 ? queue.map((q) => q.id) : null,
        scoreToShow,
        epMult,
        createdAt: Date.now(),
      }).then(() => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('offline-pending-updated'));
      });
      return;
    }
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        const uid = session?.user?.id ?? userIdRef.current;
        if (!uid) {
          runRecordedRef.current = false;
          return;
        }
        fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: uid,
            score: scoreToSave,
            totalTimeMs: totalMs,
            game_mode: modeKey,
            survival_rank: survivalRank,
            checkpoints: checkpointsRef.current?.length ? checkpointsRef.current : null,
            question_ids: mode === 'part5-national' && queue.length > 0 ? queue.map((q) => q.id) : null,
          }),
        })
          .then((res) => res.json().catch(() => ({})))
          .then((data) => {
            if (data?.error) console.warn('[runs auto-record]', data);
          });
      });
  }, [gameOver, mode, results, rank, score, queue, isTournamentMode, isOffline]);

  // サバイバル tick: 時間減算・装備効果（60s/15s）・FEVER終了・見送り判定・経過で強制終了（単語3分・Part5は5分）
  const maxGameDurationMs = mode.startsWith('vocab') ? MAX_GAME_DURATION_VOCAB_MS : MAX_GAME_DURATION_PART5_MS;
  useEffect(() => {
    if (!rank || gameOver) return;
    const eff = () => equipmentEffectsRef.current;
    const id = setInterval(() => {
      const now = Date.now();
      if (gameStartMsRef.current != null && now - gameStartMsRef.current >= maxGameDurationMs) {
        setGameOver(true);
        return;
      }
      if (survivalTimeRef.current <= 0) return;
      if (now < transitionEndRef.current) return; // 解答後〜次問表示までタイマー・バー停止
      if (now < stunUntilRef.current) return; // 硬直中は何もしない
      if (timeStopUntilRef.current > 0 && now >= timeStopUntilRef.current) {
        timeStopUntilRef.current = 0;
        setTimeStopUntil(0);
      }
      if (now < timeStopUntilRef.current) return; // タイムストップ中
      if (isBossQuestion) return; // ボス中はタイマー減らさない
      const e = eff();
      const gameElapsedMs = gameStartMsRef.current != null ? now - gameStartMsRef.current : 0;
      const interval60Ms = 60 * 1000;
      const interval15Ms = 15 * 1000;
      const st = equipmentPlayStatsRef.current;
      // 60秒区切り: 洞察・預言・韋駄天・英知
      while ((e.periodic_add_sec != null || e.prophecy_multiplier != null || e.idaten_add_sec != null || e.minute_bonus_coefficient != null) && gameElapsedMs >= lastTick60MsRef.current + interval60Ms) {
        lastTick60MsRef.current += interval60Ms;
        if (e.periodic_add_sec != null) {
          st.periodic_add_sec_sec = (st.periodic_add_sec_sec ?? 0) + e.periodic_add_sec;
          setSurvivalTimeSec((s) => { survivalTimeRef.current = Math.min(MAX_SURVIVAL_SEC, s + e.periodic_add_sec!); return Math.min(MAX_SURVIVAL_SEC, s + e.periodic_add_sec!); });
          showEffectTriggerRef.current?.('periodic_add_sec');
        }
        if (e.prophecy_multiplier != null) {
          if (Math.random() < 0.5) {
            st.prophecy_heaven_count = (st.prophecy_heaven_count ?? 0) + 1;
            setSurvivalTimeSec((s) => { const v = Math.min(MAX_SURVIVAL_SEC, s * (e.prophecy_multiplier ?? 1)); survivalTimeRef.current = v; return v; });
          } else {
            st.prophecy_hell_count = (st.prophecy_hell_count ?? 0) + 1;
            setSurvivalTimeSec((s) => { const v = Math.min(MAX_SURVIVAL_SEC, s * (e.prophecy_hell_multiplier ?? 0.5)); survivalTimeRef.current = v; return v; });
          }
        }
        if (e.idaten_add_sec != null) {
          if (Math.random() < 0.5) {
            st.idaten_add_count = (st.idaten_add_count ?? 0) + 1;
            st.idaten_add_sec = (st.idaten_add_sec ?? 0) + (e.idaten_add_sec ?? 0);
            setSurvivalTimeSec((s) => { const v = Math.min(MAX_SURVIVAL_SEC, s + (e.idaten_add_sec ?? 0)); survivalTimeRef.current = v; return v; });
          } else {
            st.idaten_subtract_count = (st.idaten_subtract_count ?? 0) + 1;
            st.idaten_subtract_sec = (st.idaten_subtract_sec ?? 0) + (e.idaten_subtract_sec ?? 30);
            setSurvivalTimeSec((s) => { const v = Math.max(0, s - (e.idaten_subtract_sec ?? 30)); survivalTimeRef.current = v; if (v <= 0) setGameOver(true); return v; });
          }
        }
        if (e.minute_bonus_coefficient != null && correctInMinuteRef.current > 0) {
          const bonus = Math.floor(correctInMinuteRef.current * e.minute_bonus_coefficient);
          st.minute_bonus_trigger_count = (st.minute_bonus_trigger_count ?? 0) + 1;
          st.minute_bonus_pt = (st.minute_bonus_pt ?? 0) + bonus;
          setScore((sc) => sc + bonus);
          correctInMinuteRef.current = 0;
          showEffectTriggerRef.current?.('minute_bonus_coefficient');
        } else if (e.minute_bonus_coefficient != null) {
          correctInMinuteRef.current = 0;
        }
      }
      // 15秒区切り: 維持のコンプレッションソックス
      while (e.auto_recovery_sec != null && gameElapsedMs >= lastTick15MsRef.current + interval15Ms) {
        lastTick15MsRef.current += interval15Ms;
        if (e.auto_recovery_sec != null) {
          st.auto_recovery_sec_sec = (st.auto_recovery_sec_sec ?? 0) + e.auto_recovery_sec;
          setSurvivalTimeSec((s) => { survivalTimeRef.current = Math.min(MAX_SURVIVAL_SEC, s + e.auto_recovery_sec!); return Math.min(MAX_SURVIVAL_SEC, s + e.auto_recovery_sec!); });
          showEffectTriggerRef.current?.('auto_recovery_sec');
        }
      }
      if (isFeverRef.current) {
        if (now >= feverEndTimeRef.current) {
          setIsFever(false);
          isFeverRef.current = false;
        }
        // FEVER 中はタイマー減らさない
      } else if (!perfectBonusActive) {
        const decayRate = e.time_decay_rate ?? 1;
        const delta = (TICK_MS / 1000) * decayRate;
        setSurvivalTimeSec((s) => {
          const next = Math.max(0, s - delta);
          survivalTimeRef.current = next;
          if (next <= 0) {
            if (e.last_stand_sec != null && !lastStandUsedRef.current) {
              lastStandUsedRef.current = true;
              const stLs = equipmentPlayStatsRef.current;
              stLs.last_stand_used = 1;
              stLs.last_stand_sec = e.last_stand_sec;
              timeStopUntilRef.current = now + e.last_stand_sec * 1000;
              setTimeStopUntil(now + e.last_stand_sec * 1000);
              playSoundIfExists('timeStop');
              showEffectTriggerRef.current?.('last_stand_sec');
              return 0.01;
            }
            const itemE = itemEffectsRef.current;
            if (itemE.phoenix_revive_sec != null && itemE.phoenix_revive_sec > 0 && !phoenixUsedRef.current) {
              phoenixUsedRef.current = true;
              const rev = Math.min(MAX_SURVIVAL_SEC, itemE.phoenix_revive_sec);
              survivalTimeRef.current = rev;
              playSoundIfExists('timeStop');
              return rev;
            }
            setGameOver(true);
          }
          return next;
        });
      }
      // バー進行率の更新（表示用）
      if (rankRef.current && currentQuestionRef.current) {
        const barDuration = getBarDurationMs(rankRef.current, comboRef.current, isFeverRef.current);
        const elapsed = now - barStartTimeRef.current;
        setBarProgress(Math.min(1, elapsed / barDuration));
        if (!answeredRef.current && elapsed >= barDuration && !isBossQuestion) {
          onSkipRef.current?.();
        }
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [rank, gameOver, isBossQuestion, perfectBonusActive, maxGameDurationMs]);

  const loadQueue = useCallback(async (staminaAmount: number = 5) => {
    staminaConsumeRef.current = staminaAmount;
    const isVocab = mode.startsWith('vocab');
    const isForYou = mode.endsWith('forYou');
    const consumeOpts = (mode === 'part5-tournament' || mode === 'vocab-tournament')
      ? { method: 'POST' as const, credentials: 'include' as const }
      : { method: 'POST' as const, credentials: 'include' as const, headers: { 'Content-Type': 'application/json' } as const, body: JSON.stringify({ amount: staminaAmount }) };

    if (mode === 'vocab-word-national') {
      try {
        const res = await fetch('/api/vocab-word-default');
        if (res.ok) {
          const data = await res.json();
          const list: VocabEntry[] = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
          if (Array.isArray(list) && list.length > 0) {
            const total = list.length;
            const initialWindow = Math.min(WINDOW_INITIAL, total);
            const asQuestions = getRandomQuestionsFromWindow(list, initialWindow, 25, total);
            if (asQuestions.length > 0) {
              if (isOffline && effectiveOfflineStamina != null) {
                if (effectiveOfflineStamina < staminaAmount) {
                  setShowStaminaModal(true);
                  setLoading(false);
                  return;
                }
              } else {
                const consumeRes = await fetch('/api/stamina', consumeOpts);
                if (consumeRes.status === 402) {
                  const json = await consumeRes.json().catch(() => ({}));
                  setNextRecoveryAt(json.nextRecoveryAt ?? null);
                  setShowStaminaModal(true);
                  setLoading(false);
                  return;
                }
                if (!consumeRes.ok) {
                  setQueue([]);
                  setLoading(false);
                  return;
                }
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('stamina-updated'));
              }
              setQueue(asQuestions);
              setWindowEnd(initialWindow);
              windowEndRef.current = initialWindow;
              setRevengeStack([]);
              revengeStackRef.current = [];
              setFeverQuestions([]);
              setFeverQuestionIndex(0);
              seenInSessionRef.current = new Set();
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // ignore
      }
      setQueue([]);
      setLoading(false);
      return;
    }

    if (mode === 'vocab-national' || mode === 'vocab-tournament') {
      try {
        let list: VocabEntry[] = [];
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cache = await getVocabCache();
          list = cache?.list ?? [];
        }
        if (list.length === 0) {
          const res = await fetch('/api/vocab-default');
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : []);
          }
        }
        if (list.length === 0) {
          const cache = await getVocabCache();
          list = cache?.list ?? [];
        }
        if (Array.isArray(list) && list.length > 0) {
          const total = list.length;
          const initialWindow = Math.min(WINDOW_INITIAL, total);
          const asQuestions = getRandomQuestionsFromWindow(list, initialWindow, 25, total);
          if (asQuestions.length > 0) {
            if (mode === 'vocab-national') {
              if (isOffline && effectiveOfflineStamina != null) {
                if (effectiveOfflineStamina < staminaAmount) {
                  setShowStaminaModal(true);
                  setLoading(false);
                  return;
                }
              } else {
                const consumeRes = await fetch('/api/stamina', consumeOpts);
                if (consumeRes.status === 402) {
                  const json = await consumeRes.json().catch(() => ({}));
                  setNextRecoveryAt(json.nextRecoveryAt ?? null);
                  setShowStaminaModal(true);
                  setLoading(false);
                  return;
                }
                if (!consumeRes.ok) {
                  setQueue([]);
                  setLoading(false);
                  return;
                }
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('stamina-updated'));
              }
            }
            fullVocabListRef.current = list;
            setQueue(asQuestions);
            setWindowEnd(initialWindow);
            windowEndRef.current = initialWindow;
            setRevengeStack([]);
            revengeStackRef.current = [];
            setFeverQuestions([]);
            setFeverQuestionIndex(0);
            seenInSessionRef.current = new Set();
            setLoading(false);
            return;
          }
        }
      } catch (_) {
        const cache = await getVocabCache();
        const list = cache?.list ?? [];
        if (list.length > 0) {
          const total = list.length;
          const initialWindow = Math.min(WINDOW_INITIAL, total);
          const asQuestions = getRandomQuestionsFromWindow(list, initialWindow, 25, total);
          if (asQuestions.length > 0 && (mode !== 'vocab-national' || (effectiveOfflineStamina != null && effectiveOfflineStamina >= staminaAmount))) {
            fullVocabListRef.current = list;
            setQueue(asQuestions);
            setWindowEnd(initialWindow);
            windowEndRef.current = initialWindow;
            setRevengeStack([]);
            revengeStackRef.current = [];
            setFeverQuestions([]);
            setFeverQuestionIndex(0);
            seenInSessionRef.current = new Set();
            setLoading(false);
            return;
          }
        }
      }
      setQueue([]);
      setLoading(false);
      return;
    }

    if (mode === 'vocab-forYou') {
      try {
        const res = await fetch('/api/vocabulary');
        if (res.ok) {
          const list = await res.json();
          if (list.length > 0) {
            const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
            let statsByWord: Record<string, VocabChoiceStats> = {};
            try {
              const cards: { word: string; meaning: string }[] = [];
              for (const v of list) {
                const raw = Array.isArray(v.meanings) && v.meanings.length > 0 ? v.meanings : [v.word];
                const normalized = raw.map((m: unknown) => stripPosForDisplay(String(m ?? '').trim())).filter(Boolean);
                const unique = [...new Set(normalized)] as string[];
                if (unique.length === 0) continue;
                const meaning = unique[Math.floor(Math.random() * unique.length)]!;
                const word = stripPosForDisplay(String(v.word ?? '').trim());
                if (!word) continue;
                cards.push({ word, meaning });
              }
              const byPos = new Map<string, string[]>();
              for (const c of cards) {
                const p = inferPosFromMeaning(c.meaning);
                if (!byPos.has(p)) byPos.set(p, []);
                byPos.get(p)!.push(c.meaning);
              }
              const wordToCandidates = new Map<string, Set<string>>();
              for (const c of cards) {
                const samePos = inferPosFromMeaning(c.meaning);
                const candidates = [...new Set(byPos.get(samePos) ?? [])].filter((m) => m !== c.meaning);
                if (!wordToCandidates.has(c.word)) wordToCandidates.set(c.word, new Set());
                candidates.forEach((m) => wordToCandidates.get(c.word)!.add(m));
              }
              const batch = [...wordToCandidates.entries()].map(([wordId, set]) => ({ wordId, candidates: [...set] }));
              if (batch.length > 0) {
                const statsRes = await fetch('/api/question-feedback/vocab-stats', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ items: batch }),
                });
                if (statsRes.ok) {
                  const data = await statsRes.json();
                  if (Array.isArray(data.items)) {
                    for (const item of data.items) {
                      if (item.wordId && Array.isArray(item.choices)) {
                        statsByWord[item.wordId] = item.choices;
                      }
                    }
                  }
                }
              }
            } catch {
              // ignore stats fetch
            }
            const asQuestions = vocabListToQuestions(list, shuffle, Object.keys(statsByWord).length > 0 ? statsByWord : undefined);
            if (asQuestions.length > 0) {
              const consumeRes = await fetch('/api/stamina', consumeOpts);
              if (consumeRes.status === 402) {
                const json = await consumeRes.json().catch(() => ({}));
                setNextRecoveryAt(json.nextRecoveryAt ?? null);
                setShowStaminaModal(true);
                setLoading(false);
                return;
              }
              if (!consumeRes.ok) {
                setQueue([]);
                setLoading(false);
                return;
              }
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('stamina-updated'));
            }
            setQueue(asQuestions);
            setLoading(false);
            return;
          }
        }
      } catch {
        // fallback
      }
      setQueue([]);
      setLoading(false);
      return;
    }

    try {
      let list: Parameters<typeof supabaseToGameQuestion>[0][] = [];
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cache = await getPart5Cache();
        const qs = cache?.questions ?? [];
        if (qs.length > 0) {
          const shuffled = [...qs].sort(() => Math.random() - 0.5);
          list = shuffled.slice(0, 20);
        }
      }
      if (list.length === 0) {
        const params = new URLSearchParams({ mode: isForYou ? 'forYou' : 'national', limit: '20' });
        if (userIdRef.current) params.set('userId', userIdRef.current);
        const res = await fetch(`/api/questions?${params}`);
        if (res.ok) {
          const data = await res.json();
          list = Array.isArray(data?.questions) ? data.questions : (Array.isArray(data) ? data : []);
        }
      }
      if (list.length === 0) {
        const cache = await getPart5Cache();
        const qs = cache?.questions ?? [];
        if (qs.length > 0) {
          const shuffled = [...qs].sort(() => Math.random() - 0.5);
          list = shuffled.slice(0, 20);
        }
      }
      if (list.length > 0) {
        if (mode !== 'part5-tournament') {
          if (isOffline && effectiveOfflineStamina != null) {
            if (effectiveOfflineStamina < staminaAmount) {
              setShowStaminaModal(true);
              setLoading(false);
              return;
            }
          } else {
            const consumeRes = await fetch('/api/stamina', consumeOpts);
            if (consumeRes.status === 402) {
              const json = await consumeRes.json().catch(() => ({}));
              setNextRecoveryAt(json.nextRecoveryAt ?? null);
              setShowStaminaModal(true);
              setLoading(false);
              return;
            }
            if (!consumeRes.ok) {
              setQueue([]);
              setLoading(false);
              return;
            }
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('stamina-updated'));
          }
        }
        setIsSupabaseQueue(true);
        setQueue(list.map(supabaseToGameQuestion));
        setLoading(false);
        return;
      }
    } catch {
      const cache = await getPart5Cache();
      const qs = cache?.questions ?? [];
      if (qs.length > 0 && (mode === 'part5-tournament' || (effectiveOfflineStamina != null && effectiveOfflineStamina >= staminaAmount))) {
        const shuffled = [...qs].sort(() => Math.random() - 0.5);
        const list = shuffled.slice(0, 20);
        setIsSupabaseQueue(true);
        setQueue(list.map(supabaseToGameQuestion));
        setLoading(false);
        return;
      }
    }
    setIsSupabaseQueue(false);
    setQueue([]);
    setLoading(false);
  }, [mode, isOffline, effectiveOfflineStamina]);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session?.user?.id) userIdRef.current = data.session.user.id;
      });
  }, []);

  useEffect(() => {
    fetch('/api/key-bindings')
      .then((r) => (r.ok ? r.json() : null))
      .then((k) => {
        if (k && typeof k === 'object') keyBindingsRef.current = k;
      })
      .catch(() => {});
  }, []);

  // 表示した問題を「出題済み」として記録（フィーバー時の未出題優先に利用）
  useEffect(() => {
    if (displayQuestion?.id) seenInSessionRef.current.add(displayQuestion.id);
  }, [displayQuestion?.id]);

  useEffect(() => {
    const run = async () => {
      if (isTournamentMode) {
        loadQueue();
        return;
      }
      if (isOffline && effectiveOfflineStamina != null) {
        if (effectiveOfflineStamina < 5) {
          setShowStaminaModal(true);
          setLoading(false);
          return;
        }
        setCurrentStaminaForSelect(effectiveOfflineStamina);
        setShowStaminaAmountSelect(true);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/stamina', { credentials: 'include' });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        const stamina = json.stamina ?? 0;
        if (stamina < 5) {
          setNextRecoveryAt(json.nextRecoveryAt ?? null);
          setShowStaminaModal(true);
          setLoading(false);
          return;
        }
        if (json.staminaInfinityActive) {
          loadQueue(5);
          return;
        }
        setCurrentStaminaForSelect(stamina);
        setShowStaminaAmountSelect(true);
        setLoading(false);
      } catch {
        setLoading(false);
        return;
      }
    };
    run();
  }, [loadQueue, isTournamentMode, isOffline, effectiveOfflineStamina]);

  // ゲームオーバー時: XP加算（オンライン時のみ。オフライン時は同期時に適用）
  useEffect(() => {
    if (!gameOver || evolutionExpAddedRef.current) return;
    const correctCount = resultsRef.current.filter((r) => r.correct).length;
    const rank = rankRef.current;
    const finalBonusGo = (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * correctCount;
    const baseScoreGo = rank != null ? scoreRef.current + finalBonusGo : correctCount;
    const scoreToShow = rank != null ? Math.round(baseScoreGo) : baseScoreGo;
    const epMult = 1 + (itemEffectsRef.current.ep_pct ?? 0) / 100;
    if (scoreToShow > 0 && (mode === 'part5-national' || mode === 'vocab-national' || mode === 'vocab-word-national') && !isTournamentMode && !isOffline) {
      evolutionExpAddedRef.current = true;
      createClient()
        .auth.getSession()
        .then(({ data }) => data.session?.user?.id)
        .then((uid) => {
          if (uid) {
            fetch('/api/evolution', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ score: scoreToShow, mode, epMult, staminaAmount: staminaConsumeRef.current ?? 5 }),
            }).catch(() => {});
          }
        });
    }
  }, [gameOver, mode, isTournamentMode, isOffline]);

  // 単語モード結果表示時: 間違えた単語をデフォルトで単語 For You に登録
  useEffect(() => {
    if (!showSummary || !mode.startsWith('vocab') || results.length === 0 || vocabWrongWordsRegisteredRef.current)
      return;
    vocabWrongWordsRegisteredRef.current = true;
    const wrongResults = results.filter((r) => !r.correct);
    if (wrongResults.length === 0) return;
    const added = new Set<string>();
    wrongResults.forEach((r) => {
      const word = r.question.question?.trim().toLowerCase();
      if (!word) return;
      added.add(word);
      const meanings = Array.isArray(r.question.options)
        ? (r.question.options as string[])
        : [String(r.question.options?.[r.question.correctIndex] ?? word)];
      fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ word, meanings }),
      }).catch(() => {});
    });
    setRegisteredWords((prev) => new Set([...prev, ...added]));
  }, [showSummary, mode, results]);

  const recordAnswerLocal = useCallback(
    async (word: GameQuestion & { progress?: WordProgress }, correct: boolean) => {
      const w = word as Word & { progress?: WordProgress };
      if (!('correctIndex' in w)) return;
      const now = Date.now();
      const progress = w.progress;
      const stage = (progress?.stage ?? 1) as 1 | 2 | 3 | 4 | 5;
      const strength = progress?.memoryStrength ?? 0.5;
      if (correct) {
        const { stage: newStage, nextIntervalMs, newStrength } = onCorrect(
          stage,
          getIntervalForStage(stage),
          strength,
          true
        );
        await db.wordProgress.put({
          wordId: w.id,
          stage: newStage,
          lastReviewedAt: now,
          nextReviewAt: now + nextIntervalMs,
          memoryStrength: newStrength,
          correctCount: (progress?.correctCount ?? 0) + 1,
        });
      } else {
        const { stage: newStage, nextIntervalMs, newStrength } = onMiss();
        await db.wordProgress.put({
          wordId: w.id,
          stage: newStage,
          lastReviewedAt: now,
          nextReviewAt: now + nextIntervalMs,
          memoryStrength: newStrength,
          correctCount: progress?.correctCount ?? 0,
        });
      }
    },
    []
  );

  const handleAnswer = useCallback(
    async (word: GameQuestion, choiceIndex: number) => {
      if (answered || postBossCooldown) return;
      const correct = choiceIndex === word.correctIndex;
      const responseTime = Date.now() - questionStartMsRef.current;

      // ボス問題で不正解: 進まずリトライ
      if (isBossQuestion && !correct) {
        setAnswered(true);
        setResult('wrong');
        const itemW = itemEffectsRef.current;
        const usePotionGuard = itemW.potion_guard != null && !potionGuardUsedRef.current;
        if (usePotionGuard) {
          potionGuardUsedRef.current = true;
        } else {
          let wrongPenalty = WRONG_PENALTY_SEC * wrongPenaltyMultiplier(evolutionRef.current.wrong_penalty, evolutionRef.current.seasonCarry?.wrong_penalty ?? 0);
          wrongPenalty *= Math.max(0, 1 - (itemW.miss_penalty_reduce_pct ?? 0) / 100);
          wrongPenalty *= itemW.miss_penalty_mult ?? 1;
          setSurvivalTimeSec((s) => Math.max(0, s - wrongPenalty));
        }
        const useComboGuardBoss = usePotionGuard || (itemW.combo_guard_chance != null && Math.random() < itemW.combo_guard_chance && !comboGuardUsedRef.current);
        if (useComboGuardBoss) {
          comboGuardUsedRef.current = true;
        } else {
          setCombo(0);
          comboRef.current = 0;
        }
        setConsecutiveCorrect(0);
        if (isFever) {
          setIsFever(false);
          isFeverRef.current = false;
        }
        setStunned(true);
        setRedFlash(true);
        const eWrongBoss = equipmentEffectsRef.current;
        if (rank) {
          let bpWrongBoss = (itemW.crown_all_rare != null ? RARITY_BASE_POINTS.RARE : RARITY_BASE_POINTS[rarityFromDifficulty(word.difficulty)]);
          if (itemW.bp_luck_chance != null && Math.random() < itemW.bp_luck_chance) bpWrongBoss *= itemW.bp_luck_mult ?? 1.2;
          if (mode === 'part5-national' && itemW.bp_part5_pct != null) bpWrongBoss *= 1 + itemW.bp_part5_pct / 100;
          if (mode === 'vocab-national' && itemW.bp_vocab_pct != null) bpWrongBoss *= 1 + itemW.bp_vocab_pct / 100;
          const effectiveComboMultWrongBoss = (combo === 0 && eWrongBoss.combo_resume_multiplier != null ? eWrongBoss.combo_resume_multiplier : comboMultiplier(combo)) + (itemW.combo_bonus_add ?? 0);
          const baseWrongBoss = Math.ceil(bpWrongBoss * effectiveComboMultWrongBoss * 1) * scoreMultiplier(evolutionRef.current.score, evolutionRef.current.seasonCarry?.score ?? 0) * (1 + (evolutionRef.current.guildScoreBonus ?? 0));
          let penaltyBoss = baseWrongBoss * WRONG_SCORE_PENALTY_RATIO * (itemW.miss_penalty_mult ?? 1);
          penaltyBoss *= Math.max(0, 1 - (itemW.miss_penalty_reduce_pct ?? 0) / 100);
          setScore((sc) => Math.max(0, sc - Math.round(penaltyBoss)));
        } else {
          setScore((sc) => Math.max(0, sc - 1));
        }
        setTimeout(() => {
          setRedFlash(false);
          setStunned(false);
          setAnswered(false);
          setResult(null);
        }, 1200);
        if (userIdRef.current && mode.startsWith('part5') && isValidQuestionIdForLog(word.id)) {
          createClient()
            .from('user_logs')
            .insert({
              user_id: userIdRef.current,
              question_id: word.id,
              correct: false,
              response_time_ms: responseTime,
              category: word.category ?? 'その他',
            })
            .then(({ error }) => {
              if (error) console.warn('user_logs insert', error.message);
            });
        }
        return;
      }

      // ボス問題で正解: 2秒以内ならタイムストップ10秒、ボス終了して次へ
      if (isBossQuestion && correct) {
        setAnswered(true);
        setResult('correct');
        if (responseTime <= 2000) {
          const now = Date.now();
          timeStopUntilRef.current = now + 10000;
          setTimeStopUntil(now + 10000);
          playSoundIfExists('timeStop');
        }
        lastBossAtMsRef.current = totalTimeMsRef.current + responseTime;
        totalTimeMsRef.current += responseTime;
        const eBoss = equipmentEffectsRef.current;
        let correctAddBoss = CORRECT_ADD_SEC * correctTimeMultiplier(evolutionRef.current.correct_time, evolutionRef.current.seasonCarry?.correct_time ?? 0);
        if (eBoss.reversal_recovery_multiplier != null && survivalTimeSec <= (eBoss.reversal_trigger_sec ?? 10)) {
          correctAddBoss *= eBoss.reversal_recovery_multiplier;
          equipmentPlayStatsRef.current.reversal_applied_count = (equipmentPlayStatsRef.current.reversal_applied_count ?? 0) + 1;
        }
        correctAddBoss *= (itemEffectsRef.current.correct_time_mult ?? 1);
        if (rank) {
          const rem = Math.min(MAX_SURVIVAL_SEC, survivalTimeSec + correctAddBoss);
          checkpointsRef.current.push({ q: currentIndex, t: totalTimeMsRef.current, remainingSec: rem });
        }
        setSurvivalTimeSec((s) => Math.min(MAX_SURVIVAL_SEC, s + correctAddBoss));
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        comboRef.current = nextCombo;
        maxComboRef.current = Math.max(maxComboRef.current, nextCombo);
        correctInMinuteRef.current += 1;
        if (rank && word.difficulty) {
          const stBoss = equipmentPlayStatsRef.current;
          const itemB = itemEffectsRef.current;
          let bpBoss = (itemB.crown_all_rare != null ? RARITY_BASE_POINTS.RARE : RARITY_BASE_POINTS[rarityFromDifficulty(word.difficulty)]);
          if (itemB.bp_luck_chance != null && Math.random() < itemB.bp_luck_chance) bpBoss *= itemB.bp_luck_mult ?? 1.2;
          if (mode === 'part5-national' && itemB.bp_part5_pct != null) bpBoss *= 1 + itemB.bp_part5_pct / 100;
          if (mode === 'vocab-national' && itemB.bp_vocab_pct != null) bpBoss *= 1 + itemB.bp_vocab_pct / 100;
          const effectiveComboMultB = (combo === 0 && eBoss.combo_resume_multiplier != null ? eBoss.combo_resume_multiplier : comboMultiplier(combo)) + (itemB.combo_bonus_add ?? 0);
          let addBoss = Math.ceil(bpBoss * effectiveComboMultB * (speedBonus(1) + (itemB.speed_bonus_add ?? 0))) * scoreMultiplier(evolutionRef.current.score, evolutionRef.current.seasonCarry?.score ?? 0) * (1 + (evolutionRef.current.guildScoreBonus ?? 0));
          if (rensaNextQuestionRef.current && eBoss.combo_bonus_multiplier != null) {
            addBoss *= eBoss.combo_bonus_multiplier;
            rensaNextQuestionRef.current = false;
            stBoss.combo_bonus_trigger_count = (stBoss.combo_bonus_trigger_count ?? 0) + 1;
          }
          addBoss = (addBoss + (eBoss.glory_stack_per_10 ?? 0) * gloryStacksRef.current) * (1 + (eBoss.score_add_rate ?? 0)) * (1 + (eBoss.xp_add_rate ?? 0)) * (1 + (eBoss.growth_ex_per_10 ?? 0) * growthStacksRef.current);
          if (itemB.correct_score_mult != null) addBoss *= itemB.correct_score_mult;
          if (nextCombo >= 50 && itemB.combo50_score_pct != null) addBoss *= 1 + itemB.combo50_score_pct / 100;
          if (eBoss.fate_heaven_multiplier != null) {
            if (Math.random() < 0.5) {
              addBoss *= eBoss.fate_heaven_multiplier;
              stBoss.fate_heaven_count = (stBoss.fate_heaven_count ?? 0) + 1;
            } else {
              addBoss = -3 * (Math.ceil(bpBoss * effectiveComboMultB * speedBonus(1)) + (eBoss.glory_stack_per_10 ?? 0) * gloryStacksRef.current);
              stBoss.fate_hell_count = (stBoss.fate_hell_count ?? 0) + 1;
            }
          }
          if (eBoss.evolution_buff_multiplier != null && Date.now() < evolutionBuffEndMsRef.current) {
            const addBeforeBuffBoss = addBoss;
            addBoss *= eBoss.evolution_buff_multiplier;
            evolutionBuffBonusRef.current += addBeforeBuffBoss * (eBoss.evolution_buff_multiplier - 1);
            stBoss.evolution_buff_question_count = (stBoss.evolution_buff_question_count ?? 0) + 1;
          }
          if (eBoss.speed_multiplier_super != null) {
            if (responseTime <= 1500) {
              addBoss *= eBoss.speed_multiplier_super;
              stBoss.speed_super_count = (stBoss.speed_super_count ?? 0) + 1;
            } else if (responseTime <= 3000) {
              addBoss *= (eBoss.speed_multiplier_super * (eBoss.speed_multiplier_fast_ratio ?? 0.6));
              stBoss.speed_fast_count = (stBoss.speed_fast_count ?? 0) + 1;
            }
          }
          if (eBoss.tekka_buff_rate != null) {
            addBoss *= 1 + eBoss.tekka_buff_rate;
            stBoss.tekka_applied_count = (stBoss.tekka_applied_count ?? 0) + 1;
          }
          if ((eBoss.score_add_rate ?? 0) > 0) {
            scoreAddRateBonusRef.current += addBoss * (eBoss.score_add_rate ?? 0) / (1 + (eBoss.score_add_rate ?? 0));
          }
          setScore((sc) => sc + Math.round(addBoss));
        }
        if (userIdRef.current && mode.startsWith('part5') && isValidQuestionIdForLog(word.id)) {
          createClient()
            .from('user_logs')
            .insert({
              user_id: userIdRef.current,
              question_id: word.id,
              correct: true,
              response_time_ms: responseTime,
              category: word.category ?? 'その他',
            })
            .then(({ error }) => {
              if (error) console.warn('user_logs insert', error.message);
            });
        }
        setResults((r) => [...r, { question: word, userChoiceIndex: choiceIndex, correct: true }]);
        setBossQuestion(null);
        setIsBossQuestion(false);
        transitionEndRef.current = Date.now();
        const nextIdx = currentIndex + 1;
        const qLen = queue.length;
        setPostBossCooldown(true);
        setTimeout(() => {
          setPostBossCooldown(false);
          if (nextIdx >= qLen) {
            setShowSummary(true);
          } else {
            setCurrentIndex(nextIdx);
            setAnswered(false);
            setResult(null);
            barStartTimeRef.current = Date.now();
          }
        }, 1500);
        return;
      }

      setAnswered(true);
      setResult(correct ? 'correct' : 'wrong');

      // サバイバル: 誤答時 -5s, 硬直 0.2s, 赤フラッシュ, コンボリセット（コンボガード時は維持）, FEVER強制終了
      if (!correct) {
        const now = Date.now();
        const itemWrong = itemEffectsRef.current;
        const usePotionGuard = itemWrong.potion_guard != null && !potionGuardUsedRef.current;
        if (usePotionGuard) {
          potionGuardUsedRef.current = true;
        } else {
          let wrongPenalty = WRONG_PENALTY_SEC * wrongPenaltyMultiplier(evolutionRef.current.wrong_penalty, evolutionRef.current.seasonCarry?.wrong_penalty ?? 0);
          wrongPenalty *= Math.max(0, 1 - (itemWrong.miss_penalty_reduce_pct ?? 0) / 100);
          wrongPenalty *= itemWrong.miss_penalty_mult ?? 1;
          setSurvivalTimeSec((s) => Math.max(0, s - wrongPenalty));
        }
        const useComboGuard = usePotionGuard || (itemWrong.combo_guard_chance != null && Math.random() < itemWrong.combo_guard_chance && !comboGuardUsedRef.current);
        if (useComboGuard) {
          comboGuardUsedRef.current = true;
        } else {
          setCombo(0);
          comboRef.current = 0;
        }
        setConsecutiveCorrect(0);
        if (isFever) {
          setIsFever(false);
          isFeverRef.current = false;
        }
        const flashMs = 80;
        stunUntilRef.current = now + flashMs;
        setStunned(true);
        setRedFlash(true);
        const eWrong = equipmentEffectsRef.current;
        // 誤答スコアペナルティ（A連打対策: 2誤答で正解1回分を相殺。装備の miss_penalty_mult / miss_penalty_reduce_pct を反映）
        if (rank) {
          let bpWrong = (itemWrong.crown_all_rare != null ? RARITY_BASE_POINTS.RARE : RARITY_BASE_POINTS[rarityFromDifficulty(word.difficulty)]);
          if (itemWrong.bp_luck_chance != null && Math.random() < itemWrong.bp_luck_chance) bpWrong *= itemWrong.bp_luck_mult ?? 1.2;
          if (mode === 'part5-national' && itemWrong.bp_part5_pct != null) bpWrong *= 1 + itemWrong.bp_part5_pct / 100;
          if (mode === 'vocab-national' && itemWrong.bp_vocab_pct != null) bpWrong *= 1 + itemWrong.bp_vocab_pct / 100;
          const effectiveComboMultWrong = (combo === 0 && eWrong.combo_resume_multiplier != null ? eWrong.combo_resume_multiplier : comboMultiplier(combo)) + (itemWrong.combo_bonus_add ?? 0);
          const baseWrong = Math.ceil(bpWrong * effectiveComboMultWrong * 1) * scoreMultiplier(evolutionRef.current.score, evolutionRef.current.seasonCarry?.score ?? 0) * (1 + (evolutionRef.current.guildScoreBonus ?? 0));
          let penalty = baseWrong * WRONG_SCORE_PENALTY_RATIO * (itemWrong.miss_penalty_mult ?? 1);
          penalty *= Math.max(0, 1 - (itemWrong.miss_penalty_reduce_pct ?? 0) / 100);
          setScore((sc) => Math.max(0, sc - Math.round(penalty)));
        } else {
          setScore((sc) => Math.max(0, sc - 1));
        }
        // 鉄火場のシルクシャツ: 不正解時50%で即ゲームオーバー
        if (eWrong.tekka_instant_death_chance != null && Math.random() < eWrong.tekka_instant_death_chance) {
          setTimeout(() => setGameOver(true), 100);
        }
        setTimeout(() => {
          setRedFlash(false);
          setStunned(false);
        }, flashMs);
        // Part 5 で間違えた問題の単語（vocab_map）を単語 For You に自動追加
        if (mode.startsWith('part5') && word.vocab_map && Object.keys(word.vocab_map).length > 0) {
          Object.entries(word.vocab_map).forEach(([w, ms]) => {
            const meaningsArr = Array.isArray(ms) ? ms.map((m) => String(m)) : [String(ms ?? w)];
            const wLower = String(w).trim().toLowerCase();
            if (!wLower) return;
            setRegisteredWords((s) => new Set(s).add(wLower));
            fetch('/api/vocabulary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ word: wLower, meanings: meaningsArr }),
            }).catch(() => {
              setRegisteredWords((s) => { const n = new Set(s); n.delete(wLower); return n; });
            });
          });
        }
      } else {
        const e = equipmentEffectsRef.current;
        const itemC = itemEffectsRef.current;
        const stCorrect = equipmentPlayStatsRef.current;
        if (combo === 0 && e.combo_resume_multiplier != null) {
          stCorrect.combo_resume_count = (stCorrect.combo_resume_count ?? 0) + 1;
        }
        // 正解: 時間加算（逆境のモノクル・クロノスの時計）
        let correctAdd = CORRECT_ADD_SEC * correctTimeMultiplier(evolutionRef.current.correct_time, evolutionRef.current.seasonCarry?.correct_time ?? 0);
        if (e.reversal_recovery_multiplier != null && survivalTimeSec <= (e.reversal_trigger_sec ?? 10)) {
          correctAdd *= e.reversal_recovery_multiplier;
          stCorrect.reversal_applied_count = (stCorrect.reversal_applied_count ?? 0) + 1;
        }
        correctAdd *= itemC.correct_time_mult ?? 1;
        setSurvivalTimeSec((s) => Math.min(MAX_SURVIVAL_SEC, s + correctAdd));
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        comboRef.current = nextCombo;
        maxComboRef.current = Math.max(maxComboRef.current, nextCombo);
        // 連鎖の万年筆: 10コンボ到達で次の1問のみ倍率
        if (e.combo_bonus_multiplier != null && nextCombo === (e.combo_bonus_trigger_combo ?? 10)) {
          rensaNextQuestionRef.current = true;
        }
        if (nextCombo === 5) {
          setComboPopup(5);
          playSoundIfExists('comboGreat');
          setTimeout(() => setComboPopup(null), 700);
        } else if (nextCombo === 10) {
          setComboPopup(10);
          playSoundIfExists('comboExcellent');
          setTimeout(() => setComboPopup(null), 700);
        }
        if (nextCombo % COMBO_BONUS_INTERVAL === 0) {
          setSurvivalTimeSec((s) => Math.min(MAX_SURVIVAL_SEC, s + COMBO_BONUS_SEC));
        }
        // 延命の修正テープ: 5問正解ごとに追加回復
        if (e.recovery_sec_per_5 != null && nextCombo % (e.recovery_sec_interval ?? 5) === 0) {
          const stR = equipmentPlayStatsRef.current;
          stR.recovery_sec_per_5_sec = (stR.recovery_sec_per_5_sec ?? 0) + e.recovery_sec_per_5;
          setSurvivalTimeSec((s) => Math.min(MAX_SURVIVAL_SEC, s + e.recovery_sec_per_5!));
          showEffectTrigger('recovery_sec_per_5');
        }
        if (nextCombo === FEVER_ENTRY_COMBO) {
          setIsFever(true);
          isFeverRef.current = true;
          feverEndTimeRef.current = Date.now() + FEVER_DURATION_SEC * 1000;
          if (mode === 'vocab-national' && fullVocabListRef.current) {
            const fq = getFeverQuestions(
              fullVocabListRef.current,
              seenInSessionRef.current,
              FEVER_QUESTIONS_COUNT
            );
            setFeverQuestions(fq);
            setFeverQuestionIndex(0);
          }
        }
        const nextConsecutive = consecutiveCorrect + 1;
        setConsecutiveCorrect(nextConsecutive);
        if (nextConsecutive >= 10) {
          setPerfectBonusActive(true);
          playSoundIfExists('perfectBonus');
          setSurvivalTimeSec((s) => Math.min(MAX_SURVIVAL_SEC, s + 10));
          setTimeout(() => {
            setPerfectBonusActive(false);
            setConsecutiveCorrect(0);
          }, 2000);
        }
        // 栄光のタキシード・成長のドレス: 10問ごとにスタック加算
        if (nextCombo % 10 === 0) {
          if (e.glory_stack_per_10 != null) {
            gloryStacksRef.current = Math.min(e.glory_max_stacks ?? 10, gloryStacksRef.current + 1);
            stCorrect.glory_max_stacks = gloryStacksRef.current;
          }
          if (e.growth_ex_per_10 != null) {
            growthStacksRef.current = Math.min(e.growth_max_stacks ?? 10, growthStacksRef.current + 1);
            stCorrect.growth_max_stacks = growthStacksRef.current;
          }
        }
        correctInMinuteRef.current += 1;
        // 基礎スコア: 装備＋アイテム効果込み
        if (rank) {
          const barDurationMs = getBarDurationMs(rank, combo, isFever);
          const elapsedMs = Date.now() - barStartTimeRef.current;
          const remainingRate = Math.max(0, Math.min(1, (barDurationMs - elapsedMs) / barDurationMs));
          let bp = (itemC.crown_all_rare != null ? RARITY_BASE_POINTS.RARE : RARITY_BASE_POINTS[rarityFromDifficulty(word.difficulty)]);
          if (itemC.bp_luck_chance != null && Math.random() < itemC.bp_luck_chance) bp *= itemC.bp_luck_mult ?? 1.2;
          if (mode === 'part5-national' && itemC.bp_part5_pct != null) bp *= 1 + itemC.bp_part5_pct / 100;
          if (mode === 'vocab-national' && itemC.bp_vocab_pct != null) bp *= 1 + itemC.bp_vocab_pct / 100;
          const effectiveComboMult = (combo === 0 && e.combo_resume_multiplier != null ? e.combo_resume_multiplier : comboMultiplier(combo)) + (itemC.combo_bonus_add ?? 0);
          const speedBonusVal = speedBonus(remainingRate) + (itemC.speed_bonus_add ?? 0);
          let baseAdd = Math.ceil(bp * effectiveComboMult * speedBonusVal) * scoreMultiplier(evolutionRef.current.score, evolutionRef.current.seasonCarry?.score ?? 0) * (1 + (evolutionRef.current.guildScoreBonus ?? 0));
          if (rensaNextQuestionRef.current && e.combo_bonus_multiplier != null) {
            baseAdd *= e.combo_bonus_multiplier;
            rensaNextQuestionRef.current = false;
            stCorrect.combo_bonus_trigger_count = (stCorrect.combo_bonus_trigger_count ?? 0) + 1;
            showEffectTrigger('combo_bonus_multiplier');
          }
          const gloryBonus = (e.glory_stack_per_10 ?? 0) * gloryStacksRef.current;
          const growthMult = 1 + (e.growth_ex_per_10 ?? 0) * growthStacksRef.current;
          let add = (baseAdd + gloryBonus) * (1 + (e.score_add_rate ?? 0)) * (1 + (e.xp_add_rate ?? 0)) * growthMult;
          const addWithoutGrowth = growthMult > 1 ? add / growthMult : add;
          scoreWithoutGrowthRef.current += Math.round(addWithoutGrowth);
          if (itemC.correct_score_mult != null) add *= itemC.correct_score_mult;
          if (nextCombo >= 50 && itemC.combo50_score_pct != null) add *= 1 + itemC.combo50_score_pct / 100;
          if (e.fate_heaven_multiplier != null) {
            if (Math.random() < 0.5) {
              add *= e.fate_heaven_multiplier;
              stCorrect.fate_heaven_count = (stCorrect.fate_heaven_count ?? 0) + 1;
            } else {
              add = -3 * (baseAdd + gloryBonus);
              stCorrect.fate_hell_count = (stCorrect.fate_hell_count ?? 0) + 1;
            }
          }
          if (e.evolution_buff_multiplier != null && Date.now() < evolutionBuffEndMsRef.current) {
            const addBeforeBuff = add;
            add *= e.evolution_buff_multiplier;
            evolutionBuffBonusRef.current += addBeforeBuff * (e.evolution_buff_multiplier - 1);
            stCorrect.evolution_buff_question_count = (stCorrect.evolution_buff_question_count ?? 0) + 1;
            if (!evolutionBuffPopupShownRef.current) {
              evolutionBuffPopupShownRef.current = true;
              showEffectTrigger('evolution_buff_multiplier');
            }
          }
          if (e.speed_multiplier_super != null) {
            if (responseTime <= 1500) {
              add *= e.speed_multiplier_super;
              stCorrect.speed_super_count = (stCorrect.speed_super_count ?? 0) + 1;
            } else if (responseTime <= 3000) {
              add *= (e.speed_multiplier_super * (e.speed_multiplier_fast_ratio ?? 0.6));
              stCorrect.speed_fast_count = (stCorrect.speed_fast_count ?? 0) + 1;
            }
          }
          if (e.tekka_buff_rate != null) {
            add *= 1 + e.tekka_buff_rate;
            stCorrect.tekka_applied_count = (stCorrect.tekka_applied_count ?? 0) + 1;
          }
          if ((e.score_add_rate ?? 0) > 0) {
            scoreAddRateBonusRef.current += add * (e.score_add_rate ?? 0) / (1 + (e.score_add_rate ?? 0));
          }
          setScore((sc) => sc + Math.round(add));
        } else {
          setScore((sc) => sc + 1);
        }
      }

      if (!isSupabaseQueue) {
        const w = await db.words.get(word.id);
        if (w) {
          const p = await db.wordProgress.get(word.id);
          await recordAnswerLocal({ ...w, progress: p } as GameQuestion & { progress?: WordProgress }, correct);
        }
      }

      if (userIdRef.current && mode.startsWith('part5') && isValidQuestionIdForLog(word.id)) {
        createClient()
          .from('user_logs')
          .insert({
            user_id: userIdRef.current,
            question_id: word.id,
            correct,
            response_time_ms: responseTime,
            category: word.category ?? 'その他',
          })
          .then(({ error }) => {
            if (error) console.warn('user_logs insert', error.message);
          });
      }

      totalTimeMsRef.current += responseTime;
      if (rank) {
        const nextComboVal = correct ? combo + 1 : 0;
        const correctAdd = CORRECT_ADD_SEC * correctTimeMultiplier(evolutionRef.current.correct_time, evolutionRef.current.seasonCarry?.correct_time ?? 0);
        const wrongPenalty = WRONG_PENALTY_SEC * wrongPenaltyMultiplier(evolutionRef.current.wrong_penalty, evolutionRef.current.seasonCarry?.wrong_penalty ?? 0);
        const rem = correct
          ? Math.min(
              MAX_SURVIVAL_SEC,
              survivalTimeSec + correctAdd + (nextComboVal % COMBO_BONUS_INTERVAL === 0 ? COMBO_BONUS_SEC : 0)
            )
          : Math.max(0, survivalTimeSec - wrongPenalty);
        checkpointsRef.current.push({ q: currentIndex, t: totalTimeMsRef.current, remainingSec: rem });
      }
      setResults((r) => [...r, { question: word, userChoiceIndex: choiceIndex, correct }]);
      if (!correct && word.type === 'vocabulary' && word.options?.[choiceIndex]) {
        fetch('/api/question-feedback/record-wrong', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            source: 'vocab',
            questionId: word.question?.trim() ?? '',
            choiceKey: String(word.options[choiceIndex]).trim(),
          }),
        }).catch(() => {});
      }
      const transitionMs = 0;
      transitionEndRef.current = Date.now() + transitionMs;

      const wasFeverQuestion =
        mode === 'vocab-national' &&
        feverQuestions.length > 0 &&
        feverQuestionIndex < feverQuestions.length &&
        word.id === feverQuestions[feverQuestionIndex]?.id;

      if (mode === 'vocab-national' && !wasFeverQuestion && word) {
        const list = fullVocabListRef.current;
        const nextWindowEnd = correct
          ? Math.min(list?.length ?? windowEnd, windowEnd + WINDOW_EXPAND_STEP)
          : Math.max(WINDOW_INITIAL, windowEnd - WINDOW_EXPAND_STEP);
        const nextRevengeStack = !correct ? [...revengeStack, word] : revengeStack;
        setWindowEnd(nextWindowEnd);
        if (queue.length - (currentIndex + 2) <= VOCAB_REFILL_THRESHOLD && list) {
          const { questions: batch, usedRevengeIds } = buildRefillBatch(
            list,
            nextWindowEnd,
            nextRevengeStack,
            VOCAB_REFILL_BATCH_SIZE,
            list.length
          );
          setQueue((q) => [...q, ...batch]);
          setRevengeStack(nextRevengeStack.filter((x) => !usedRevengeIds.includes(x.id)));
        } else if (!correct) {
          setRevengeStack(nextRevengeStack);
        }
      }

      if (wasFeverQuestion) {
        setFeverQuestionIndex((i) => i + 1);
        setAnswered(false);
        setResult(null);
        barStartTimeRef.current = Date.now();
      } else if (currentIndex + 1 >= queue.length) {
        setShowSummary(true);
      } else {
        const nowMs = totalTimeMsRef.current;
        if (
          mode.startsWith('part5') &&
          rank &&
          nowMs - lastBossAtMsRef.current >= 30000
        ) {
          lastBossAtMsRef.current = nowMs;
          fetch('/api/boss-question?mode=part5')
            .then((res) => (res.ok ? res.json() : null))
            .then((q) => {
              if (q) {
                setBossQuestion(q);
                setIsBossQuestion(true);
                setBossWarningShown(false);
                playSoundIfExists('bossWarning');
                // BOSS 突入時に時間を少し追加（所見殺し軽減）
                setSurvivalTimeSec((s) => Math.min(MAX_SURVIVAL_SEC, s + 10));
              }
            })
            .catch(() => {})
            .finally(() => {
              setAnswered(false);
              setResult(null);
              barStartTimeRef.current = Date.now();
            });
        } else {
          setCurrentIndex((i) => i + 1);
          setAnswered(false);
          setResult(null);
          barStartTimeRef.current = Date.now();
        }
      }
    },
    [
      answered,
      postBossCooldown,
      currentIndex,
      queue.length,
      mode,
      recordAnswerLocal,
      combo,
      isFever,
      consecutiveCorrect,
      isBossQuestion,
      rank,
      windowEnd,
      revengeStack,
      feverQuestions,
      feverQuestionIndex,
      showEffectTrigger,
    ]
  );

  const handleTimeout = useCallback(
    async (word: GameQuestion) => {
      if (answered) return;
      setAnswered(true);
      setResult('wrong');
      const responseTime = Date.now() - questionStartMsRef.current;
      if (userIdRef.current && mode.startsWith('part5') && isValidQuestionIdForLog(word.id)) {
        createClient()
          .from('user_logs')
          .insert({
            user_id: userIdRef.current,
            question_id: word.id,
            correct: false,
            response_time_ms: responseTime,
            category: word.category ?? 'その他',
          })
          .then(({ error }) => {
            if (error) console.warn('user_logs insert', error.message);
          });
      }
      totalTimeMsRef.current += responseTime;
      if (rank) {
        checkpointsRef.current.push({
          q: currentIndex,
          t: totalTimeMsRef.current,
          remainingSec: survivalTimeSec,
        });
      }
      setCombo(0);
      setResults((r) => [...r, { question: word, userChoiceIndex: -1, correct: false }]);

      const wasFeverQuestion =
        mode === 'vocab-national' &&
        feverQuestions.length > 0 &&
        feverQuestionIndex < feverQuestions.length &&
        word.id === feverQuestions[feverQuestionIndex]?.id;

      if (mode === 'vocab-national' && !wasFeverQuestion && word) {
        const list = fullVocabListRef.current;
        const nextWindowEnd = Math.max(WINDOW_INITIAL, windowEnd - WINDOW_EXPAND_STEP);
        const nextRevengeStack = [...revengeStack, word];
        setWindowEnd(nextWindowEnd);
        if (queue.length - (currentIndex + 2) <= VOCAB_REFILL_THRESHOLD && list) {
          const { questions: batch, usedRevengeIds } = buildRefillBatch(
            list,
            nextWindowEnd,
            nextRevengeStack,
            VOCAB_REFILL_BATCH_SIZE,
            list.length
          );
          setQueue((q) => [...q, ...batch]);
          setRevengeStack(nextRevengeStack.filter((x) => !usedRevengeIds.includes(x.id)));
        } else {
          setRevengeStack(nextRevengeStack);
        }
      }

      if (wasFeverQuestion) {
        setTimeout(() => {
          setFeverQuestionIndex((i) => i + 1);
          setAnswered(false);
          setResult(null);
        }, 600);
      } else if (currentIndex + 1 >= queue.length) {
        setTimeout(() => setShowSummary(true), 600);
      } else {
        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
          setAnswered(false);
          setResult(null);
        }, 600);
      }
    },
    [
      answered,
      currentIndex,
      queue.length,
      mode,
      rank,
      survivalTimeSec,
      windowEnd,
      revengeStack,
      feverQuestions,
      feverQuestionIndex,
    ]
  );

  /** 見送り（バーが画面端に到達）: -3s, コンボリセット, 揺れ */
  const handleSkip = useCallback(
    (word: GameQuestion) => {
      if (answered) return;
      answeredRef.current = true;
      setAnswered(true);
      setResult('wrong');
      setSurvivalTimeSec((s) => Math.max(0, s - SKIP_PENALTY_SEC));
      const skipBarMs = rank ? getBarDurationMs(rank, combo, isFever) : 0;
      if (rank) {
        checkpointsRef.current.push({
          q: currentIndex,
          t: totalTimeMsRef.current + skipBarMs,
          remainingSec: Math.max(0, survivalTimeSec - SKIP_PENALTY_SEC),
        });
      }
      totalTimeMsRef.current += skipBarMs;
      setCombo(0);
      comboRef.current = 0;
      setConsecutiveCorrect(0);
      if (isFever) {
        setIsFever(false);
        isFeverRef.current = false;
      }
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 400);
      if (userIdRef.current && mode.startsWith('part5') && isValidQuestionIdForLog(word.id)) {
        const responseTimeMs = skipBarMs;
        createClient()
          .from('user_logs')
          .insert({
            user_id: userIdRef.current,
            question_id: word.id,
            correct: false,
            response_time_ms: responseTimeMs,
            category: word.category ?? 'その他',
          })
          .then(({ error }) => {
            if (error) console.warn('user_logs insert', error.message);
          });
      }
      setResults((r) => [...r, { question: word, userChoiceIndex: -1, correct: false }]);
      transitionEndRef.current = Date.now();

      const wasFeverQuestion =
        mode === 'vocab-national' &&
        feverQuestions.length > 0 &&
        feverQuestionIndex < feverQuestions.length &&
        word.id === feverQuestions[feverQuestionIndex]?.id;

      if (mode === 'vocab-national' && !wasFeverQuestion && word) {
        const list = fullVocabListRef.current;
        const nextWindowEnd = Math.max(WINDOW_INITIAL, windowEnd - WINDOW_EXPAND_STEP);
        const nextRevengeStack = [...revengeStack, word];
        setWindowEnd(nextWindowEnd);
        if (queue.length - (currentIndex + 2) <= VOCAB_REFILL_THRESHOLD && list) {
          const { questions: batch, usedRevengeIds } = buildRefillBatch(
            list,
            nextWindowEnd,
            nextRevengeStack,
            VOCAB_REFILL_BATCH_SIZE,
            list.length
          );
          setQueue((q) => [...q, ...batch]);
          setRevengeStack(nextRevengeStack.filter((x) => !usedRevengeIds.includes(x.id)));
        } else {
          setRevengeStack(nextRevengeStack);
        }
      }

      if (wasFeverQuestion) {
        setFeverQuestionIndex((i) => i + 1);
        setAnswered(false);
        setResult(null);
        barStartTimeRef.current = Date.now();
      } else if (currentIndex + 1 >= queue.length) {
        setShowSummary(true);
      } else {
        setCurrentIndex((i) => i + 1);
        setAnswered(false);
        setResult(null);
        barStartTimeRef.current = Date.now();
      }
    },
    [
      answered,
      currentIndex,
      queue.length,
      mode,
      rank,
      combo,
      isFever,
      survivalTimeSec,
      windowEnd,
      revengeStack,
      feverQuestions,
      feverQuestionIndex,
    ]
  );

  useEffect(() => {
    onSkipRef.current = () => {
      const q = currentQuestionRef.current;
      if (q) handleSkip(q);
    };
    return () => {
      onSkipRef.current = null;
    };
  }, [handleSkip]);

  const goToResult = useCallback(async () => {
    const totalCorrect = results.filter((r) => r.correct).length;
    const finalBonus = (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * totalCorrect;
    const baseScore = rank != null ? score + finalBonus : totalCorrect;
    const scoreToSave = rank != null ? Math.round(baseScore) : baseScore;
    const modeKey = mode.startsWith('vocab') ? 'vocab' : 'part5';
    const survivalRank = rank ?? 'ACE';
    if ((mode === 'part5-national' || mode === 'vocab-national' || mode === 'vocab-word-national') && !runRecordedRef.current) {
      const totalMs = typeof totalTimeMsRef.current === 'number' && Number.isFinite(totalTimeMsRef.current)
        ? totalTimeMsRef.current
        : 0;
      const staminaAmount = staminaConsumeRef.current ?? 5;
      const scoreToShow = rank != null ? Math.round(score + (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * totalCorrect) : totalCorrect;
      const epMult = 1 + (itemEffectsRef.current.ep_pct ?? 0) / 100;

      if (isOffline) {
        runRecordedRef.current = true;
        await addPendingRun({
          id: crypto.randomUUID(),
          score: scoreToSave,
          totalTimeMs: totalMs,
          game_mode: modeKey,
          staminaAmount,
          survival_rank: survivalRank,
          checkpoints: checkpointsRef.current?.length ? checkpointsRef.current : undefined,
          question_ids: mode === 'part5-national' && queue.length > 0 ? queue.map((q) => q.id) : null,
          scoreToShow,
          epMult,
          createdAt: Date.now(),
        });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('offline-pending-updated'));
      } else {
        const { data: { session } } = await createClient().auth.getSession();
        const uid = session?.user?.id ?? userIdRef.current;
        if (uid) {
          runRecordedRef.current = true;
          const res = await fetch('/api/runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId: uid,
              score: scoreToSave,
              totalTimeMs: totalMs,
              game_mode: modeKey,
              survival_rank: survivalRank,
              checkpoints: checkpointsRef.current?.length ? checkpointsRef.current : null,
              question_ids: mode === 'part5-national' && queue.length > 0 ? queue.map((q) => q.id) : null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.error('[runs insert]', res.status, data);
            try {
              sessionStorage.setItem('runs_insert_error', JSON.stringify({
                message: data?.message ?? data?.error ?? '記録に失敗しました',
              }));
            } catch {
              // ignore
            }
          }
        } else {
          try {
            sessionStorage.setItem('runs_insert_error', JSON.stringify({ message: 'not_logged_in' }));
          } catch {
            // ignore
          }
        }
      }
    }
    router.push(isTournamentMode ? '/tournament' : (mode === 'part5-national' || mode === 'vocab-national' || mode === 'vocab-word-national' ? '/ranking' : '/'));
  }, [results, mode, router, rank, score, queue, isTournamentMode, isOffline]);

  const handleRegisterWord = useCallback(
    async (word: string, meanings: string[] | unknown) => {
      const w = String(word || '').trim().toLowerCase();
      if (!w) return;
      const meaningsArr = Array.isArray(meanings) ? meanings.map((m) => String(m)) : [w];
      setRegisteredWords((s) => new Set(s).add(w));
      try {
        const res = await fetch('/api/vocabulary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ word: w, meanings: meaningsArr }),
        });
        if (!res.ok && res.status === 401) {
          setRegisteredWords((s) => {
            const next = new Set(s);
            next.delete(w);
            return next;
          });
        }
      } catch {
        setRegisteredWords((s) => {
          const next = new Set(s);
          next.delete(w);
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    const cur = displayQuestion ?? queue[currentIndex] ?? null;
    if (!cur || answered || stunned) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
      const key = e.key.toLowerCase();
      const k = keyBindingsRef.current;
      if (!k) return;
      let index = -1;
      if (key === k.topLeft) index = 0;
      else if (key === k.topRight) index = 1;
      else if (key === k.bottomLeft) index = 2;
      else if (key === k.bottomRight) index = 3;
      if (index >= 0) {
        e.preventDefault();
        handleAnswer(cur, index);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [displayQuestion, queue, currentIndex, answered, stunned, handleAnswer]);

  if (showStaminaAmountSelect && currentStaminaForSelect != null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4">
        <h1 className="text-lg font-bold text-white">消費スタミナを選択</h1>
        <p className="text-center text-sm text-zinc-400">
          まとめて使うとXPに傾斜がかかります（スコアは等倍）。現在: {currentStaminaForSelect}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {STAMINA_CONSUME_OPTIONS.map((amount) => {
            const disabled = amount > currentStaminaForSelect;
            const selected = staminaAmountToConsume === amount;
            const mult = getXpMultiplierForStamina(amount);
            return (
              <button
                key={amount}
                type="button"
                disabled={disabled}
                onClick={() => setStaminaAmountToConsume(amount)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  disabled
                    ? 'cursor-not-allowed border-zinc-700 bg-zinc-800/50 text-zinc-500'
                    : selected
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700'
                }`}
              >
                {amount}
                <span className="ml-1 text-xs opacity-90">({mult}×XP)</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setShowStaminaAmountSelect(false);
            setLoading(true);
            loadQueue(staminaAmountToConsume);
          }}
          className="rounded-lg border border-amber-500 bg-amber-500/20 px-6 py-3 text-base font-medium text-amber-400 hover:bg-amber-500/30"
        >
          プレイ開始
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden />
          <LoadingWithPercent className="text-white" />
        </div>
      </div>
    );
  }

  if (showStaminaModal) {
    const nextSec =
      nextRecoveryAt != null
        ? Math.max(0, Math.floor((nextRecoveryAt - Date.now()) / 1000))
        : undefined;
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <p className="text-white">スタミナが足りません</p>
        </div>
        <StaminaModal
          open={showStaminaModal}
          onClose={() => router.push('/')}
          nextRecoverySeconds={nextSec}
        />
      </>
    );
  }

  if (showSummary && results.length > 0) {
    const correctCountForSummary = results.filter((r) => r.correct).length;
    const correctRateForSummary = correctCountForSummary / results.length;
    const finalBonusSummary = (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * correctCountForSummary;
    const baseScoreSummary = rank != null ? score + finalBonusSummary : undefined;
    const totalScoreWithBonus = baseScoreSummary != null ? Math.round(baseScoreSummary) : undefined;
    const summaryShunRank = rank != null ? getShunRank(totalScoreWithBonus ?? score, maxComboRef.current, correctRateForSummary) : null;
    const summaryScoreBreakdown =
      rank != null && totalScoreWithBonus != null
        ? { type: 'survival' as const, base: score, equipmentBonus: finalBonusSummary, total: totalScoreWithBonus }
        : totalScoreWithBonus != null
          ? { type: 'sixty' as const, correctCount: correctCountForSummary, total: totalScoreWithBonus }
          : undefined;
    const playDurationSecSummary = Math.floor(totalTimeMsRef.current / 1000);
    const runContextSummary: RunContext = {
      correctCount: correctCountForSummary,
      playDurationSec: playDurationSecSummary,
      score,
      scoreAddRateBonus: Math.round(scoreAddRateBonusRef.current),
      evolutionBuffBonus: Math.round(evolutionBuffBonusRef.current),
    };
    const slotLabelsSummary: Record<string, string> = { weapon: '武器', head: '頭', torso: '胴体', feet: '足' };
    const epMultSummary = 1 + (itemEffectsRef.current.ep_pct ?? 0) / 100;
    const xpMultiplierSummary = mode === 'part5-national' ? 3 : 1;
    const staminaXpMultSummary = getXpMultiplierForStamina(staminaConsumeRef.current ?? 5);
    const correctTimeMultSummary = correctTimeMultiplier(evolutionRef.current?.correct_time ?? 0, evolutionRef.current?.seasonCarry?.correct_time ?? 0);
    const baseXpSummary = (totalScoreWithBonus ?? 0) * 0.03;
    const gainedExpSummary = Math.floor(baseXpSummary * epMultSummary * xpMultiplierSummary * correctTimeMultSummary * staminaXpMultSummary);
    const baseScoreWithoutGrowthSummary = rank != null ? scoreWithoutGrowthRef.current + finalBonusSummary : (totalScoreWithBonus ?? 0);
    const xpWithoutGrowthSummary = Math.floor(baseScoreWithoutGrowthSummary * 0.03 * epMultSummary * xpMultiplierSummary * correctTimeMultSummary * staminaXpMultSummary);
    type SlotDetailSummary = { slot: string; slotLabel: string; name: string | null; effectText: string | null; contributionPt?: number; actionSummary: string[] };
    const equipmentDetailBySlotSummary: SlotDetailSummary[] = [];
    const equippedSummary = equippedRef.current;
    const effectsSummary = equipmentEffectsRef.current;
    const playStatsSummary = equipmentPlayStatsRef.current;
    const byIdSummary = new Map(GACHA_EQUIPMENT.map((e) => [e.id, e]));
    for (const slot of ['weapon', 'head', 'torso', 'feet'] as const) {
      const eq = equippedSummary[slot];
      const slotLabel = slotLabelsSummary[slot] ?? slot;
      if (!eq) {
        equipmentDetailBySlotSummary.push({ slot, slotLabel, name: null, effectText: null, actionSummary: [] });
        continue;
      }
      const def = byIdSummary.get(eq.equipment_id);
      if (!def?.effectKey) {
        equipmentDetailBySlotSummary.push({ slot, slotLabel, name: def?.name ?? eq.equipment_id, effectText: null, actionSummary: [] });
        continue;
      }
      const val = effectsSummary[def.effectKey as keyof EquipmentEffects];
      const effectText = val != null && typeof val === 'number' ? formatEffectDescription(def.effect, val) : def.effect;
      const contributionPt = def.effectKey === 'final_bonus_coefficient' ? Math.round(finalBonusSummary) : undefined;
      const xpGrowthSummary: XpGrowthBreakdown | undefined = def.effectKey === 'growth_ex_per_10' ? { xpWithout: xpWithoutGrowthSummary, xpWith: gainedExpSummary } : undefined;
      const actionSummary = buildEquipmentActionSummary(def.effectKey, playStatsSummary, contributionPt, runContextSummary, xpGrowthSummary);
      equipmentDetailBySlotSummary.push({
        slot,
        slotLabel,
        name: def.name,
        effectText,
        contributionPt,
        actionSummary,
      });
    }
    return (
      <SummaryScreen
        mode={mode}
        results={results}
        onRegisterWord={handleRegisterWord}
        registeredWords={registeredWords}
        onFinish={goToResult}
        onPlayAgain={() => router.push(`/game?mode=${encodeURIComponent(mode)}&_=${Date.now()}`)}
        onGoToVocabForYou={() => {
          router.push('/game?mode=vocab-forYou');
        }}
        totalScore={totalScoreWithBonus}
        scoreBreakdown={summaryScoreBreakdown}
        maxCombo={rank != null ? maxComboRef.current : undefined}
        shunRank={summaryShunRank}
        equipmentDetailBySlot={equipmentDetailBySlotSummary}
        runContextData={runContextSummary}
        scoreBreakdownForData={summaryScoreBreakdown}
        gainedExp={gainedExpSummary}
        onBadQuestion={async (source, questionId, choiceKey) => {
          const key = `${source}|${questionId}|${choiceKey}`;
          if (badQuestionSent.has(key)) return;
          try {
            await fetch('/api/question-feedback/bad', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ source, questionId, choiceKey }),
            });
            setBadQuestionSent((s) => new Set(s).add(key));
          } catch {
            // ignore
          }
        }}
        badQuestionSent={badQuestionSent}
      />
    );
  }

  // 初回ルール説明モーダル（サバイバル系モード・スキップしていない場合）
  if (showRuleModal === true && queue.length > 0) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 safe-area-pad">
        <div className="w-full max-w-md rounded-2xl border border-gold-subtle bg-zinc-900/95 p-6 shadow-xl">
          <h2 className="text-lg font-bold text-gold">ルール</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            正解するほど制限時間が延び、ミスすると減ります。コンボを繋いでスコアを伸ばし、ランキングで競いましょう。
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            装備やガチャのアイテムで、スコアや時間を有利にできます。
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={ruleSkipNext}
              onChange={(e) => setRuleSkipNext(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-500 text-amber-500 focus:ring-amber-500"
            />
            次回からスキップ
          </label>
          <button
            type="button"
            onClick={() => {
              if (ruleSkipNext && typeof window !== 'undefined') window.localStorage.setItem('closer_rule_modal_skip', '1');
              setShowRuleModal(false);
            }}
            className="mt-5 w-full rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-3 font-medium text-gold hover:bg-[var(--gold)]/30 active:opacity-90"
          >
            始める
          </button>
        </div>
      </div>
    );
  }

  if (!current && !gameOver) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 safe-area-pad">
        <p className="text-center text-white sm:text-left">
          {mode === 'vocab-forYou'
            ? '単語 For You に登録された単語がありません。結果画面で単語をタップして追加するか、Part 5 でわからない単語をタップして追加しましょう。'
            : mode === 'vocab-word-national'
              ? '単語→単語用のリストを読み込めませんでした。data/vocab-word.json を用意するか「再読み込み」をお試しください。'
              : mode === 'vocab-national'
                ? '全国単語モード用の単語リストを読み込めませんでした。アカウントには依存しません。しばらく経ってから「再読み込み」を押すか、ホームへ戻って再度お試しください。'
                : mode.startsWith('vocab')
                  ? '登録単語がありません。Part 5の問題で単語をタップして追加しましょう。'
                  : '出題する問題がありません'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {(mode === 'vocab-national' || mode === 'vocab-word-national') && (
            <button
              type="button"
              onClick={() => { setLoading(true); loadQueue(); }}
              className="touch-target rounded-lg border border-amber-500 bg-transparent px-5 py-2.5 font-bold text-amber-500 active:opacity-90"
            >
              再読み込み
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="touch-target rounded-lg bg-amber-500 px-6 py-3 font-bold text-black active:opacity-90"
          >
            ホームへ
          </button>
        </div>
      </div>
    );
  }

  // For You: 3カウント表示後に即開始（vocab-forYou のみ・ランク選択なし）
  if (queue.length > 0 && rank === null && current && mode === 'vocab-forYou') {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 safe-area-pad">
        <p className="mb-4 text-sm text-zinc-500">単語 For You</p>
        {forYouCountdown !== null && forYouCountdown > 0 ? (
          <motion.span
            key={forYouCountdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-8xl font-black text-amber-400 sm:text-9xl"
          >
            {forYouCountdown}
          </motion.span>
        ) : (
          <span className="text-lg text-zinc-500">準備中...</span>
        )}
      </div>
    );
  }

  // ランク選択後の3秒カウント（全国・Part5 For You）：3→2→1→開始
  if (
    queue.length > 0 &&
    rank === null &&
    current &&
    mode !== 'vocab-forYou' &&
    selectedRank !== null &&
    countdownBeforeStart !== null
  ) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 safe-area-pad">
        <p className="mb-4 text-sm text-zinc-500">
          {mode === 'part5-national'
            ? 'Part 5 全国モード'
            : mode === 'part5-forYou'
              ? 'Part 5 For You'
              : mode === 'part5-tournament'
                ? '大会 Part 5'
                : mode === 'vocab-tournament'
                  ? '大会 単語'
                  : mode === 'vocab-word-national'
                    ? '単語→単語 全国モード'
                    : '単語 全国モード'}
        </p>
        {countdownBeforeStart > 0 ? (
          <motion.span
            key={countdownBeforeStart}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-8xl font-black text-amber-400 sm:text-9xl"
          >
            {countdownBeforeStart}
          </motion.span>
        ) : (
          <span className="text-lg text-zinc-500">開始...</span>
        )}
      </div>
    );
  }

  // 全国モードでカウント開始前の一瞬（ランク選択廃止のため表示のみ）
  if (
    queue.length > 0 &&
    rank === null &&
    current &&
    mode !== 'vocab-forYou' &&
    selectedRank === null &&
    countdownBeforeStart === null
  ) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 safe-area-pad">
        <p className="text-zinc-500">まもなく開始...</p>
      </div>
    );
  }

  // ゲームオーバー（残り時間0）
  if (gameOver) {
    const correctCountForRank = results.filter((r) => r.correct).length;
    const correctRateForRank = results.length ? correctCountForRank / results.length : 0;
    const finalBonusGo = (equipmentEffectsRef.current.final_bonus_coefficient ?? 0) * correctCountForRank;
    const baseScoreGo = rank != null ? score + finalBonusGo : correctCountForRank;
    const scoreToShow = rank != null ? Math.round(baseScoreGo) : baseScoreGo;
    const scoreBreakdown =
      rank != null
        ? { type: 'survival' as const, base: score, equipmentBonus: finalBonusGo, total: scoreToShow }
        : { type: 'sixty' as const, correctCount: correctCountForRank, total: scoreToShow };
    const epMult = 1 + (itemEffectsRef.current.ep_pct ?? 0) / 100;
    const xpMultiplier = mode === 'part5-national' ? 3 : 1;
    const staminaXpMult = getXpMultiplierForStamina(staminaConsumeRef.current ?? 5);
    const correctTimeMult = correctTimeMultiplier(evolutionRef.current?.correct_time ?? 0, evolutionRef.current?.seasonCarry?.correct_time ?? 0);
    const baseXp = scoreToShow * 0.03;
    const gainedExp = Math.floor(baseXp * epMult * xpMultiplier * correctTimeMult * staminaXpMult);
    const baseScoreWithoutGrowth = rank != null ? scoreWithoutGrowthRef.current + finalBonusGo : scoreToShow;
    const xpWithoutGrowth = Math.floor(baseScoreWithoutGrowth * 0.03 * epMult * xpMultiplier * correctTimeMult * staminaXpMult);
    const xpBreakdown = { baseXp, epMult, xpMultiplier, correctTimeMult, gainedExp, xpWithoutGrowth: rank != null ? xpWithoutGrowth : gainedExp };
    const shunRank: ShunRank = rank != null ? getShunRank(scoreToShow, maxComboRef.current, correctRateForRank) : null;
    const playDurationSec = Math.floor(totalTimeMsRef.current / 1000);
    const runContext: RunContext = {
      correctCount: correctCountForRank,
      playDurationSec,
      score,
      scoreAddRateBonus: Math.round(scoreAddRateBonusRef.current),
      evolutionBuffBonus: Math.round(evolutionBuffBonusRef.current),
    };
    const slotLabels: Record<string, string> = { weapon: '武器', head: '頭', torso: '胴体', feet: '足' };
    const equipped = equippedRef.current;
    const effects = equipmentEffectsRef.current;
    const playStats = equipmentPlayStatsRef.current;
    const byId = new Map(GACHA_EQUIPMENT.map((e) => [e.id, e]));
    type SlotDetail = { slot: string; slotLabel: string; name: string | null; effectText: string | null; contributionPt?: number; actionSummary: string[] };
    const equipmentDetailBySlot: SlotDetail[] = [];
    for (const slot of ['weapon', 'head', 'torso', 'feet'] as const) {
      const eq = equipped[slot];
      const slotLabel = slotLabels[slot] ?? slot;
      if (!eq) {
        equipmentDetailBySlot.push({ slot, slotLabel, name: null, effectText: null, actionSummary: [] });
        continue;
      }
      const def = byId.get(eq.equipment_id);
      if (!def?.effectKey) {
        equipmentDetailBySlot.push({ slot, slotLabel, name: def?.name ?? eq.equipment_id, effectText: null, actionSummary: [] });
        continue;
      }
      const val = effects[def.effectKey as keyof EquipmentEffects];
      const effectText = val != null && typeof val === 'number' ? formatEffectDescription(def.effect, val) : def.effect;
      const contributionPt = def.effectKey === 'final_bonus_coefficient' ? Math.round(finalBonusGo) : undefined;
      const xpGrowth: XpGrowthBreakdown | undefined = def.effectKey === 'growth_ex_per_10' ? { xpWithout: xpBreakdown.xpWithoutGrowth, xpWith: xpBreakdown.gainedExp } : undefined;
      const actionSummary = buildEquipmentActionSummary(def.effectKey, playStats, contributionPt, runContext, xpGrowth);
      equipmentDetailBySlot.push({
        slot,
        slotLabel,
        name: def.name,
        effectText,
        contributionPt,
        actionSummary,
      });
    }

    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center gap-10 home-bg px-4 py-10 safe-area-pad">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[#D4AF37]/90">プレイ終了</p>
        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-2 text-2xl font-bold text-red-400/95 sm:text-3xl"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          TIME UP
        </motion.h1>
        <p className="mt-4 text-xl font-bold text-white sm:text-2xl">Score: <span className="text-gold">{scoreToShow.toLocaleString()}</span> pt</p>
        {isTournamentMode ? (
          <p className="mt-2 text-sm text-zinc-500">大会スコア（スタミナ消費・XP・通常ランキングには反映されません）</p>
        ) : (
          <p className="mt-2 text-lg font-semibold text-emerald-400">獲得XP +{xpBreakdown.gainedExp} XP</p>
        )}
        <div className="mt-6 w-full max-w-md rounded-xl border border-gold-subtle brass-card px-5 py-4 text-left text-sm">
          <p className="mb-3 font-medium text-zinc-300">装着装備</p>
          <ul className="space-y-2">
            {equipmentDetailBySlot.map((row, i) => (
              <li key={i}>
                <span className="text-zinc-500">【{row.slotLabel}】</span>
                {row.name ? (
                  <>
                    <span className="ml-1 font-medium text-amber-200/90">{row.name}</span>
                    {row.actionSummary[0] && <span className="ml-1 text-zinc-400">・{row.actionSummary[0]}</span>}
                  </>
                ) : (
                  <span className="ml-1 text-zinc-500">未装備</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {rank != null && shunRank && (
          <p className="mt-6 text-lg font-bold text-amber-400 sm:text-xl">認定: {shunRank}級</p>
        )}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="touch-target rounded-xl border border-gold-subtle brass-card px-8 py-3 font-semibold text-gold transition-colors hover:border-[#D4AF37]/60 hover:text-gold-bright active:opacity-90"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            結果を見る
          </button>
          <button
            type="button"
            onClick={() => router.push(isTournamentMode ? '/tournament' : '/')}
            className="touch-target rounded-xl border border-gold-subtle/60 bg-white/5 px-6 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-gold-subtle/50 hover:text-zinc-300 active:opacity-90"
          >
            {isTournamentMode ? '大会画面へ' : 'ホームへ'}
          </button>
        </div>
      </div>
    );
  }

  const timeoutMs = current?.type === 'grammar' ? GRAMMAR_TIMEOUT_MS : VOCAB_TIMEOUT_MS;
  const barDurationMs = rank ? getBarDurationMs(rank, combo, isFever) : timeoutMs;

  return (
    <div
      className={`relative flex min-h-screen min-h-[100dvh] flex-col bg-zinc-950 transition-colors duration-150 safe-area-pad ${
        isFever ? 'bg-orange-950/80' : ''
      } ${redFlash ? 'bg-red-950/60' : ''}`}
    >
      {/* 赤フラッシュオーバーレイ */}
      <AnimatePresence>
        {redFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-10 bg-red-500/30"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {comboPopup !== null && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center pt-[min(22vh,180px)]"
          >
            <span className="text-5xl font-black tracking-wider text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] sm:text-6xl">
              {comboPopup === 5 ? 'GREAT!' : 'EXCELLENT!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {effectTriggerPopup && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center pt-[min(22vh,180px)]"
          >
            <span className="text-lg font-bold text-amber-400">
              {GACHA_EQUIPMENT.find((e) => e.id === effectTriggerPopup.equipmentId)?.name ?? '装備効果発動'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {perfectBonusActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed inset-0 z-25 flex items-center justify-center bg-amber-500/10"
        >
          <motion.span
            initial={{ scale: 0.8 }}
            animate={{ scale: 1.1 }}
            transition={{ repeat: 1, duration: 1 }}
            className="text-4xl font-black text-amber-400"
          >
            PERFECT! +10s
          </motion.span>
        </motion.div>
      )}
      <AnimatePresence>
        {isBossQuestion && !bossWarningShown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-red-950/90 px-4"
          >
            <span className="text-4xl font-black tracking-widest text-red-400 drop-shadow-[0_0_24px_rgba(248,113,113,0.9)] sm:text-5xl">
              BOSS
            </span>
            <p className="max-w-sm text-center text-sm text-red-200/90">
              制限時間が短め。正解で延び・ミスで減。集中して挑戦！
            </p>
            <button
              type="button"
              onClick={() => setBossWarningShown(true)}
              className="rounded-lg border-2 border-red-400 bg-red-500/20 px-6 py-3 font-bold text-red-100 hover:bg-red-500/30 active:opacity-90"
            >
              OK
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* BOSS クリア後 1.5秒の誤タップ防止オーバーレイ */}
      {postBossCooldown && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/80">
          <p className="text-2xl font-bold text-amber-400">BOSS クリア!</p>
          <p className="mt-2 text-sm text-zinc-400">まもなく次の問題へ</p>
        </div>
      )}
      {/* ネオンゲージ（画面上部） */}
      {rank && (
        <div className="shrink-0 px-4 pt-4">
          <NeonGauge
            valueSec={survivalTimeSec}
            maxSec={MAX_SURVIVAL_SEC}
            ghostRemainingSec={ghostRemainingSec}
          />
        </div>
      )}

      <header className="flex shrink-0 items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('ゲームをやめてホームに戻りますか？')) router.push('/');
          }}
          className="touch-target min-h-[44px] min-w-[44px] text-sm text-zinc-400 active:opacity-80 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="ゲームをやめる"
        >
          ← やめる
        </button>
        <div className="flex items-center gap-4">
          {isFever && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-lg font-bold text-orange-400"
            >
              FEVER
            </motion.span>
          )}
          <AnimatePresence mode="wait">
            {combo >= 2 && !isFever && (
              <motion.span
                key={combo}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                className="text-lg font-bold text-amber-400"
              >
                {combo} COMBO
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-zinc-500">
            {currentIndex + 1} / {queue.length}
          </span>
          {rank && <span className="text-zinc-500">Score: {score}</span>}
        </div>
      </header>

      <motion.div
        className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4"
        animate={screenShake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {current && (
          <>
            {rank ? (
              <CrystalBar
                word={current}
                barProgress={barProgress}
                result={result}
                answered={answered}
                isFever={isFever}
              />
            ) : (
              <StreamCube
                word={current}
                durationMs={timeoutMs}
                onTimeout={() => handleTimeout(current)}
                result={result}
                answered={answered}
              />
            )}

            {!answered && (
              <div className="grid w-full max-w-lg grid-cols-2 gap-2 sm:gap-3">
                {current.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleAnswer(current, i)}
                    disabled={answered || stunned || postBossCooldown}
                    className={`touch-target min-h-[48px] rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition-colors sm:min-h-[52px] sm:px-4 sm:py-4 sm:text-base ${
                      result === 'correct' && i === current.correctIndex
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : result === 'wrong' && i === current.correctIndex
                          ? 'border-green-500 bg-green-500/20 text-green-400'
                          : result === 'wrong' && i !== current.correctIndex && answered
                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                            : 'border-zinc-600 bg-zinc-800 text-white hover:border-amber-500/50'
                    }`}
                  >
                    {current.type === 'vocabulary' ? stripPosForDisplay(opt) : opt}
                  </motion.button>
                ))}
              </div>
            )}
            {answered && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-zinc-500"
              >
                {result === 'correct' ? '正解！' : '不正解'}
              </motion.p>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

/** 画面上部のネオン管ゲージ。時間で 青→黄→赤 に変化。ゴーストは自己ベスト時点の残り時間の位置に光点 */
function NeonGauge({
  valueSec,
  maxSec,
  ghostRemainingSec = null,
}: {
  valueSec: number;
  maxSec: number;
  ghostRemainingSec?: number | null;
}) {
  const pct = Math.min(1, Math.max(0, valueSec / maxSec));
  const color =
    pct > 1 / 2 ? 'from-cyan-400 to-blue-500' : pct > 1 / 3 ? 'from-amber-400 to-yellow-500' : 'from-red-400 to-red-600';
  const ghostPct =
    ghostRemainingSec != null ? Math.min(1, Math.max(0, ghostRemainingSec / maxSec)) : null;
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-zinc-800 shadow-[0_0_12px_rgba(0,0,0,0.5)]">
      <div
        className={`h-3 rounded-full bg-gradient-to-r ${color} transition-all duration-150 ease-linear shadow-[0_0_8px_currentColor]`}
        style={{ width: `${pct * 100}%` }}
      />
      {ghostPct != null && (
        <div
          className="absolute top-0 h-3 w-1 rounded-full bg-white/90 shadow-[0_0_6px_2px_rgba(255,255,255,0.8)]"
          style={{ left: `${ghostPct * 100}%`, transform: 'translateX(-50%)' }}
          aria-hidden
        />
      )}
    </div>
  );
}

/** 横長クリスタル・バー。barProgress 0→1 で右へ進行。正解で中央から割れて 0/1 粒子 */
function CrystalBar({
  word,
  barProgress,
  result,
  answered,
  isFever,
}: {
  word: GameQuestion;
  barProgress: number;
  result: 'correct' | 'wrong' | null;
  answered: boolean;
  isFever: boolean;
}) {
  const [showParticles, setShowParticles] = useState(false);
  useEffect(() => {
    if (result === 'correct') {
      setShowParticles(true);
      const t = setTimeout(() => setShowParticles(false), 1200);
      return () => clearTimeout(t);
    }
  }, [result]);

  return (
    <div className="relative w-full max-w-lg px-1">
      <motion.div
        animate={
          result
            ? { scale: result === 'correct' ? 1.02 : 0.98, opacity: result === 'correct' ? 1 : 0.8 }
            : { scale: 1, opacity: 1 }
        }
        className={`relative overflow-hidden rounded-2xl border-2 px-4 py-6 shadow-xl sm:px-8 sm:py-10 ${
          isFever ? 'border-orange-500/70 bg-orange-950/50' : 'border-cyan-500/40 bg-zinc-900'
        }`}
      >
        {showParticles && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-1 overflow-hidden p-4"
          >
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 1, x: 0, y: 0 }}
                animate={{
                  opacity: 0,
                  x: (i % 2 ? 1 : -1) * (60 + Math.random() * 80),
                  y: (Math.random() - 0.5) * 100,
                }}
                transition={{ duration: 0.6 }}
                className="text-xs font-mono text-cyan-400"
              >
                {i % 2 ? '1' : '0'}
              </motion.span>
            ))}
          </motion.div>
        )}
        <p className="relative text-center text-lg font-bold leading-snug text-white sm:text-2xl">
          {word.type === 'vocabulary' ? stripPosForDisplay(word.question) : word.question}
        </p>
      </motion.div>
      {/* バー進行（左→右に伸びる = 画面端へ向かう） */}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
          style={{ width: `${barProgress * 100}%` }}
          transition={{ duration: TICK_MS / 1000 }}
        />
      </div>
    </div>
  );
}

type ScoreBreakdown =
  | { type: 'survival'; base: number; equipmentBonus: number; total: number }
  | { type: 'sixty'; correctCount: number; total: number };

/** プレイ中に装備効果ごとに記録した発動・寄与（結果画面の「今回のプレイで」表示用） */
type EquipmentPlayStats = Partial<{
  recovery_sec_per_5_sec: number;
  periodic_add_sec_sec: number;
  auto_recovery_sec_sec: number;
  idaten_add_count: number;
  idaten_add_sec: number;
  idaten_subtract_count: number;
  idaten_subtract_sec: number;
  prophecy_heaven_count: number;
  prophecy_hell_count: number;
  last_stand_used: number;
  last_stand_sec: number;
  minute_bonus_trigger_count: number;
  minute_bonus_pt: number;
  combo_bonus_trigger_count: number;
  glory_max_stacks: number;
  growth_max_stacks: number;
  evolution_buff_question_count: number;
  fate_heaven_count: number;
  fate_hell_count: number;
  speed_super_count: number;
  speed_fast_count: number;
  tekka_applied_count: number;
  reversal_applied_count: number;
  combo_resume_count: number;
  /** 熟練の蛍光マーカー等: 成長スタックによるスコア加算分（pt） */
  growth_bonus_score: number;
}>;

/** 算出用データ（結果画面のビフォアアフター用） */
type RunContext = {
  correctCount: number;
  playDurationSec: number;
  score: number;
  scoreAddRateBonus: number;
  evolutionBuffBonus: number;
};

/** 成長スタック装備のXP寄与（装備なし時とあり時の獲得XP）。熟練の蛍光マーカー等の具体的な数値表示用 */
export type XpGrowthBreakdown = { xpWithout: number; xpWith: number };

/** 効果キーとプレイ統計から「今回のプレイで」の説明行を生成。runContext があるときはビフォアアフター・算出データを追加。xpGrowth があるときは成長装備で「X XP → Y XP」を追記 */
function buildEquipmentActionSummary(
  effectKey: string,
  stats: EquipmentPlayStats,
  finalBonusPt?: number,
  runContext?: RunContext,
  xpGrowth?: XpGrowthBreakdown
): string[] {
  const lines: string[] = [];
  switch (effectKey) {
    case 'recovery_sec_per_5':
      if ((stats.recovery_sec_per_5_sec ?? 0) > 0) {
        const sec = Math.round(stats.recovery_sec_per_5_sec!);
        if (runContext) {
          const min = Math.floor(runContext.playDurationSec / 60);
          lines.push(`プレイ時間 約${min}分 のため 5秒ごとに発動 → 時間を +${sec}秒 延長`);
        } else {
          lines.push(`時間を +${sec}秒 延長`);
        }
      }
      break;
    case 'score_add_rate':
      if (runContext && runContext.scoreAddRateBonus > 0) {
        const before = Math.round(runContext.score - runContext.scoreAddRateBonus);
        const after = runContext.score;
        lines.push(`加算率なしの場合 基礎スコア ${before.toLocaleString()} → 適用後 ${after.toLocaleString()}（+${Math.round(runContext.scoreAddRateBonus).toLocaleString()} pt 増加）`);
      } else {
        lines.push('全正解のスコアに加算率を適用');
      }
      break;
    case 'xp_add_rate':
      lines.push('獲得XPに加算率を適用');
      break;
    case 'minute_bonus_coefficient':
      if ((stats.minute_bonus_trigger_count ?? 0) > 0) {
        lines.push(`1分区切りボーナスを ${stats.minute_bonus_trigger_count} 回発動`);
        if ((stats.minute_bonus_pt ?? 0) > 0) {
          lines.push(`→ 基礎スコアに +${stats.minute_bonus_pt} pt 加算`);
        }
      }
      break;
    case 'combo_bonus_multiplier':
      if ((stats.combo_bonus_trigger_count ?? 0) > 0) lines.push(`10コンボ到達後の次の1問で倍率を ${stats.combo_bonus_trigger_count} 回発動`);
      break;
    case 'reversal_recovery_multiplier':
      if ((stats.reversal_applied_count ?? 0) > 0) lines.push(`残り10秒以下で回復倍率を ${stats.reversal_applied_count} 回適用`);
      break;
    case 'combo_resume_multiplier':
      if ((stats.combo_resume_count ?? 0) > 0) lines.push(`コンボ途切れ時の倍率維持を ${stats.combo_resume_count} 回適用`);
      break;
    case 'periodic_add_sec':
      if ((stats.periodic_add_sec_sec ?? 0) > 0) {
        const sec = Math.round(stats.periodic_add_sec_sec!);
        if (runContext) {
          const min = Math.floor(runContext.playDurationSec / 60);
          lines.push(`プレイ時間 ${runContext.playDurationSec}秒（約${min}分）のため 60秒ごとに発動 → 時間を +${sec}秒 延長`);
        } else {
          lines.push(`時間を +${sec}秒 延長`);
        }
      }
      break;
    case 'prophecy_multiplier':
      if ((stats.prophecy_heaven_count ?? 0) > 0 || (stats.prophecy_hell_count ?? 0) > 0) {
        if (runContext) {
          const min = Math.floor(runContext.playDurationSec / 60);
          lines.push(`プレイ時間 約${min}分 のため 60秒ごとに判定 → 預言 天国${stats.prophecy_heaven_count ?? 0}回・地獄${stats.prophecy_hell_count ?? 0}回 発動`);
        } else {
          lines.push(`預言を 天国${stats.prophecy_heaven_count ?? 0}回・地獄${stats.prophecy_hell_count ?? 0}回 発動`);
        }
      }
      break;
    case 'last_stand_sec':
      if (stats.last_stand_used) {
        if (runContext) {
          const min = Math.floor(runContext.playDurationSec / 60);
          lines.push(`プレイ時間 約${min}分 で残り0秒付近に到達 → 土俵際で時間停止を ${Math.round(stats.last_stand_sec ?? 0)}秒 使用`);
        } else {
          lines.push(`土俵際で時間停止を ${Math.round(stats.last_stand_sec ?? 0)}秒 使用`);
        }
      }
      break;
    case 'glory_stack_per_10':
      if ((stats.glory_max_stacks ?? 0) > 0) lines.push(`栄光スタックを最大 ${stats.glory_max_stacks} まで蓄積`);
      break;
    case 'growth_ex_per_10': {
      const m = stats.growth_max_stacks ?? 0;
      if (xpGrowth && xpGrowth.xpWith > xpGrowth.xpWithout) {
        lines.push(`獲得XP 装備なしなら ${xpGrowth.xpWithout.toLocaleString()} XP → 装備あり ${xpGrowth.xpWith.toLocaleString()} XP（+${(xpGrowth.xpWith - xpGrowth.xpWithout).toLocaleString()} XP 増加）`);
      }
      if (runContext) {
        const n = runContext.correctCount;
        if (m > 0) {
          lines.push(`正解数 ${n} → 10問ごとスタック最大 ${m}`);
        } else {
          lines.push(`正解数 ${n} → 10問に満たずスタック0（10問ごとにスタック蓄積）`);
        }
      } else if (m > 0) {
        lines.push(`成長スタックを最大 ${m} まで蓄積`);
      }
      break;
    }
    case 'evolution_buff_multiplier':
      if ((stats.evolution_buff_question_count ?? 0) > 0) {
        const m = stats.evolution_buff_question_count;
        if (runContext && runContext.evolutionBuffBonus > 0) {
          lines.push(`開始時バフを ${m} 問に適用 → その${m}問分のスコア増分 +${Math.round(runContext.evolutionBuffBonus).toLocaleString()} pt（基礎スコアに含まれる。バフなしならこの${m}問で得られたスコアより約 +${Math.round(runContext.evolutionBuffBonus).toLocaleString()} pt 多い）`);
        } else {
          lines.push(`開始時バフを ${m} 問に適用`);
        }
      }
      break;
    case 'final_bonus_coefficient':
      if (finalBonusPt != null && finalBonusPt > 0) lines.push(`スコアに +${finalBonusPt} pt 寄与`);
      break;
    case 'fate_heaven_multiplier':
      if ((stats.fate_heaven_count ?? 0) > 0 || (stats.fate_hell_count ?? 0) > 0) {
        lines.push(`運命を 天国${stats.fate_heaven_count ?? 0}回・地獄${stats.fate_hell_count ?? 0}回 発動`);
      }
      break;
    case 'speed_multiplier_super':
      if ((stats.speed_super_count ?? 0) > 0 || (stats.speed_fast_count ?? 0) > 0) {
        lines.push(`スピードボーナスを スーパー${stats.speed_super_count ?? 0}回・ファスト${stats.speed_fast_count ?? 0}回 発動`);
      }
      break;
    case 'tekka_buff_rate':
      if ((stats.tekka_applied_count ?? 0) > 0) lines.push(`正解時の鉄火バフを ${stats.tekka_applied_count} 回適用`);
      break;
    case 'auto_recovery_sec':
      if ((stats.auto_recovery_sec_sec ?? 0) > 0) {
        const sec = Math.round(stats.auto_recovery_sec_sec!);
        if (runContext) {
          const min = Math.floor(runContext.playDurationSec / 60);
          lines.push(`プレイ時間 約${min}分 のため 15秒ごとに発動 → 時間を +${sec}秒 延長`);
        } else {
          lines.push(`時間を +${sec}秒 延長`);
        }
      }
      break;
    case 'idaten_add_sec':
      if ((stats.idaten_add_sec ?? 0) > 0 || (stats.idaten_subtract_sec ?? 0) > 0) {
        if (runContext) {
          const min = Math.floor(runContext.playDurationSec / 60);
          lines.push(`プレイ時間 約${min}分 のため 60秒ごとに判定`);
        }
        if ((stats.idaten_add_sec ?? 0) > 0) lines.push(`時間を +${Math.round(stats.idaten_add_sec!)}秒 延長`);
        if ((stats.idaten_subtract_sec ?? 0) > 0) lines.push(`時間を -${Math.round(stats.idaten_subtract_sec!)}秒 減少（${stats.idaten_subtract_count ?? 0}回）`);
      }
      break;
    case 'time_decay_rate':
      lines.push('残り時間の減少量に影響');
      break;
    default:
      break;
  }
  return lines;
}

function SummaryScreen({
  mode,
  results,
  onRegisterWord,
  registeredWords,
  onFinish,
  onPlayAgain,
  onGoToVocabForYou,
  totalScore,
  scoreBreakdown,
  maxCombo,
  shunRank,
  equipmentDetailBySlot = [],
  gainedExp,
  onBadQuestion,
  badQuestionSent = new Set(),
}: {
  mode: GameMode;
  results: { question: GameQuestion; userChoiceIndex: number; correct: boolean }[];
  onRegisterWord: (word: string, meanings: string[]) => void;
  registeredWords: Set<string>;
  onFinish: () => void;
  onPlayAgain: () => void;
  onGoToVocabForYou?: () => void;
  totalScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  maxCombo?: number;
  shunRank?: ShunRank;
  equipmentDetailBySlot?: { slot: string; slotLabel: string; name: string | null; effectText: string | null; contributionPt?: number; actionSummary: string[] }[];
  runContextData?: RunContext;
  scoreBreakdownForData?: ScoreBreakdown;
  gainedExp?: number;
  onBadQuestion?: (source: 'vocab' | 'part5', questionId: string, choiceKey: string) => void;
  badQuestionSent?: Set<string>;
}) {
  const correctCount = results.filter((r) => r.correct).length;
  const isVocab = mode.startsWith('vocab');
  const isPart5 = mode.startsWith('part5');

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col home-bg px-4 py-6 safe-area-pad sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[#D4AF37]/90">解説</p>
        <h2 className="mt-1 text-center text-lg font-bold text-white sm:text-xl" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>結果</h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          {correctCount} / {results.length} 正解
        </p>
        {totalScore != null && (
          <p className="mt-2 text-center text-sm text-zinc-300">
            Score: <span className="font-bold text-gold">{totalScore.toLocaleString()}</span> pt
            {shunRank != null && (
              <span className="ml-2 font-bold text-amber-400">認定: {shunRank}級</span>
            )}
          </p>
        )}
        {typeof gainedExp === 'number' && (
          <p className="mt-1 text-center text-sm font-semibold text-emerald-400">獲得XP +{gainedExp} XP</p>
        )}
        {scoreBreakdown && (
          <p className="mt-1 text-center text-xs text-zinc-500">
            {scoreBreakdown.type === 'survival'
              ? `内訳: 基礎スコア ${scoreBreakdown.base} + 装備 ${scoreBreakdown.equipmentBonus} → ${scoreBreakdown.total} pt`
              : `内訳: 正解数 ${scoreBreakdown.correctCount} pt → ${scoreBreakdown.total} pt`}
          </p>
        )}
        {equipmentDetailBySlot.length > 0 && (
          <div className="mt-4 rounded-xl border border-gold-subtle brass-card px-4 py-3 text-left text-sm">
            <p className="mb-2 font-medium text-zinc-300">装着装備</p>
            <ul className="space-y-1.5">
              {equipmentDetailBySlot.map((row, i) => (
                <li key={i}>
                  <span className="text-zinc-500">【{row.slotLabel}】</span>
                  {row.name ? (
                    <>
                      <span className="ml-1 font-medium text-amber-200/90">{row.name}</span>
                      {row.actionSummary[0] && <span className="ml-1 text-zinc-400">・{row.actionSummary[0]}</span>}
                    </>
                  ) : (
                    <span className="ml-1 text-zinc-500">未装備</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {isPart5 && (
          <p className="mt-2 text-xs text-zinc-500">
            わからない単語をタップすると単語 For You に追加され、単語モードで出題されます
          </p>
        )}
        {isVocab && (
          <p className="mt-2 text-xs text-zinc-500">
            間違えた単語は自動で単語 For You に登録済みです
          </p>
        )}

        <div className="mt-6 space-y-6">
          {results.map((r, i) => (
            <motion.div
              key={r.question.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-4 ${
                r.question.type === 'vocabulary'
                  ? 'border-emerald-600/50 bg-emerald-950/30'
                  : 'border-cyan-600/50 bg-cyan-950/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Q{i + 1}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  r.question.type === 'vocabulary' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                }`}>
                  {r.question.type === 'vocabulary' ? '単語' : 'Part 5'}
                </span>
              </div>
              <p className="mt-1 font-medium text-white">
                {r.question.type === 'vocabulary' ? stripPosForDisplay(r.question.question) : r.question.question}
              </p>
              <p className={`mt-1 text-sm ${r.correct ? 'text-green-400' : 'text-red-400'}`}>
                正解: {r.question.type === 'vocabulary' ? stripPosForDisplay(r.question.options[r.question.correctIndex]) : r.question.options[r.question.correctIndex]}
                {!r.correct && r.userChoiceIndex >= 0 && (
                  <span className="ml-2">あなた: {r.question.type === 'vocabulary' ? stripPosForDisplay(r.question.options[r.userChoiceIndex]) : r.question.options[r.userChoiceIndex]}</span>
                )}
              </p>
              {/* 良問・悪問（悪問＝選択した選択肢を「出題から除外」対象に。一定数でその選択肢は出題されなくなる） */}
              {onBadQuestion && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
                  >
                    良問
                  </button>
                  {r.userChoiceIndex >= 0 && r.question.options?.[r.userChoiceIndex] != null && (() => {
                    const source = r.question.type === 'vocabulary' ? 'vocab' : 'part5';
                    const questionId = r.question.type === 'vocabulary' ? (r.question.question ?? '') : (r.question.id ?? '');
                    const choiceKey = String(r.question.options[r.userChoiceIndex]);
                    const sentKey = `${source}|${questionId}|${choiceKey}`;
                    return (
                      <button
                        type="button"
                        disabled={badQuestionSent.has(sentKey)}
                        onClick={() => onBadQuestion(source, questionId, choiceKey)}
                        className="rounded border border-amber-600/50 px-2 py-1 text-xs text-amber-400 hover:border-amber-500 disabled:opacity-50"
                      >
                        {badQuestionSent.has(sentKey) ? '悪問 送信済み' : '悪問（この選択肢を除外候補に）'}
                      </button>
                    );
                  })()}
                </div>
              )}
              {r.question.explanation && (
                <p className="mt-2 text-sm text-zinc-400">{r.question.explanation}</p>
              )}
              {/* Part 5: vocab_map に載っている単語だけタップで For You に追加可能 */}
              {isPart5 && r.question.vocab_map && Object.keys(r.question.vocab_map).length > 0 && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-zinc-500">タップで単語 For You に追加（意味付きの単語のみ）</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(r.question.vocab_map).map(([word, meanings]) => {
                      const ms = Array.isArray(meanings) ? meanings : [String(meanings ?? word)];
                      const wLower = word.trim().toLowerCase();
                      return (
                        <button
                          key={word}
                          type="button"
                          onClick={() => onRegisterWord(word, ms)}
                          className={`min-h-[44px] cursor-pointer rounded-lg border px-2 py-1.5 text-sm touch-manipulation ${
                            registeredWords.has(wLower)
                              ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                              : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-amber-500/50'
                          }`}
                        >
                          {word} → {ms[0]}
                          {registeredWords.has(wLower) && ' ✓'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* 単語モード: 問題の単語。間違えたものは自動で For You 登録済み。正解もタップで登録可能 */}
              {r.question.type === 'vocabulary' && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-zinc-500">
                    このボタンをタップすると単語 For You に自動追加されます
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRegisterWord(r.question.question, r.question.options as unknown as string[]);
                    }}
                    className={`cursor-pointer rounded-lg border px-2 py-1 text-sm touch-manipulation ${
                      registeredWords.has(r.question.question.toLowerCase())
                        ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                        : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-amber-500/50'
                    }`}
                  >
                    {r.question.type === 'vocabulary' ? stripPosForDisplay(r.question.question) : r.question.question} → {r.question.type === 'vocabulary' ? stripPosForDisplay(r.question.options[r.question.correctIndex]) : r.question.options[r.question.correctIndex]}
                    {registeredWords.has(r.question.question.toLowerCase()) && '（For You に登録済み）'}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {isVocab && onGoToVocabForYou && (
            <button
              type="button"
              onClick={() => onGoToVocabForYou()}
              className="touch-target w-full rounded-xl border border-gold-subtle brass-card py-4 font-semibold text-gold transition-colors hover:border-[#D4AF37]/60 hover:text-gold-bright active:opacity-90"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              For You で練習
            </button>
          )}
          <button
            type="button"
            onClick={() => onPlayAgain()}
            className="touch-target w-full rounded-xl border border-gold-subtle brass-card py-4 font-semibold text-white transition-colors hover:border-[#D4AF37]/60 hover:text-gold active:opacity-90"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            もう一度プレイ
          </button>
          <button
            type="button"
            onClick={() => onFinish()}
            className="touch-target w-full rounded-xl border border-gold-subtle/60 bg-white/5 py-4 font-medium text-zinc-400 transition-colors hover:border-gold-subtle/50 hover:text-zinc-300 active:opacity-90"
          >
            終了
          </button>
        </div>
      </div>
    </div>
  );
}

function StreamCube({
  word,
  durationMs,
  onTimeout,
  result,
  answered,
}: {
  word: GameQuestion;
  durationMs: number;
  onTimeout: () => void;
  result: 'correct' | 'wrong' | null;
  answered: boolean;
}) {
  useEffect(() => {
    if (answered) return;
    const t = setTimeout(() => onTimeout(), durationMs);
    return () => clearTimeout(t);
  }, [word.id, durationMs, onTimeout, answered]);

  return (
    <div className="relative w-full max-w-lg">
      <motion.div
        animate={
          result
            ? { scale: 1.05, opacity: result === 'correct' ? 1 : 0.7 }
            : { scale: 1, opacity: 1 }
        }
        className="rounded-2xl border-2 border-amber-500/50 bg-zinc-900 px-8 py-10 shadow-xl"
      >
        <p className="text-center text-2xl font-bold text-white">
          {word.type === 'vocabulary' ? stripPosForDisplay(word.question) : word.question}
        </p>
        <p className="mt-2 text-center text-sm text-zinc-500">
          {word.type === 'vocabulary' ? '5秒' : '10秒'}で回答
        </p>
      </motion.div>
      <div className="absolute -bottom-2 left-0 right-0 h-1 overflow-hidden rounded-full bg-zinc-700">
        <motion.div
          className="h-full bg-amber-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
        />
      </div>
    </div>
  );
}

