'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getDownloadState,
  setDownloadState,
  setVocabCache,
  setPart5Cache,
  setStaminaMeta,
  getPendingRunsCount,
  getPendingRuns,
  removePendingRunsByIds,
  getStaminaMeta,
  getPendingRunsStaminaTotal,
} from '@/lib/offline-db';
import { computeCurrentStamina, getMaxStamina } from '@/lib/stamina';
import type { OfflineStaminaMeta } from '@/lib/offline-db';

export type OfflineDownloadPhase = 'idle' | 'checking' | 'first' | 'update' | 'ready';

type OfflineContextValue = {
  /** 初回 or 更新ダウンロード中は true */
  downloadPhase: OfflineDownloadPhase;
  /** 初回はスキップ不可 */
  canSkipDownload: boolean;
  /** ダウンロード進捗 0..1 */
  downloadProgress: number;
  downloadLabel: string;
  /** ダウンロード実行（初回 or 更新で「ダウンロード」押下） */
  runDownload: (onComplete?: () => void) => Promise<void>;
  /** 更新をスキップ（2回目以降のみ） */
  skipUpdate: () => void;
  /** 未送信 run 件数 */
  pendingRunsCount: number;
  /** 今すぐ送信 */
  syncPendingRuns: () => Promise<{ synced: number; error?: string }>;
  /** オンラインか */
  isOnline: boolean;
  /** オフライン計算スタミナ（未送信消費を引いた実質値。オフライン時のみ） */
  effectiveOfflineStamina: number | null;
  /** オフライン時の最大スタミナ（表示用） */
  offlineMaxStamina: number | null;
  /** スタミナメタを保存（GET /api/stamina?offline=1 成功時に呼ぶ） */
  saveStaminaMeta: (meta: OfflineStaminaMeta) => Promise<void>;
  /** オフラインかどうか（navigator.onLine が false または未送信ありでオフライン扱い） */
  isOffline: boolean;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [downloadPhase, setDownloadPhase] = useState<OfflineDownloadPhase>('checking');
  const [canSkipDownload, setCanSkipDownload] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState('');
  const [pendingRunsCount, setPendingRunsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineStamina, setOfflineStamina] = useState<number | null>(null);
  const [offlineMaxStamina, setOfflineMaxStamina] = useState<number | null>(null);
  const [pendingStaminaTotal, setPendingStaminaTotal] = useState(0);

  const saveStaminaMeta = useCallback(async (meta: OfflineStaminaMeta) => {
    await setStaminaMeta(meta);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const n = await getPendingRunsCount();
    setPendingRunsCount(n);
  }, []);

  const syncPendingRuns = useCallback(async (): Promise<{ synced: number; error?: string }> => {
    const runs = await getPendingRuns();
    if (runs.length === 0) return { synced: 0 };
    try {
      const res = await fetch('/api/runs/offline-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          runs: runs.map((r) => ({
            id: r.id,
            score: r.score,
            totalTimeMs: r.totalTimeMs,
            game_mode: r.game_mode,
            staminaAmount: r.staminaAmount,
            survival_rank: r.survival_rank,
            checkpoints: r.checkpoints,
            question_ids: r.question_ids,
            scoreToShow: r.scoreToShow,
            epMult: r.epMult,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { synced: 0, error: (data as { message?: string }).message ?? (data as { error?: string }).error ?? '送信に失敗しました' };
      }
      const processed = Array.isArray((data as { processedIds?: string[] }).processedIds) ? (data as { processedIds: string[] }).processedIds : [];
      await removePendingRunsByIds(processed);
      await refreshPendingCount();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('stamina-updated'));
      return { synced: processed.length };
    } catch (e) {
      return { synced: 0, error: (e instanceof Error ? e.message : '送信に失敗しました') };
    }
  }, [refreshPendingCount]);

  const runDownload = useCallback(async (onComplete?: () => void) => {
    setDownloadPhase('first');
    setCanSkipDownload(false);
    setDownloadProgress(0);
    setDownloadLabel('単語をダウンロード中...');
    try {
      const vocabRes = await fetch('/api/vocab-default', { credentials: 'include' });
      if (!vocabRes.ok) throw new Error('単語の取得に失敗しました');
      const vocabData = await vocabRes.json();
      const list = Array.isArray(vocabData?.list) ? vocabData.list : (Array.isArray(vocabData) ? vocabData : []);
      const version = vocabData?.version ?? `${list.length}`;
      await setVocabCache({ version, list });
      setDownloadProgress(0.5);
      setDownloadLabel('Part 5 をダウンロード中...');

      const part5Res = await fetch('/api/questions/offline-bundle', { credentials: 'include' });
      if (!part5Res.ok) throw new Error('Part 5 の取得に失敗しました');
      const part5Data = await part5Res.json();
      const questions = Array.isArray(part5Data?.questions) ? part5Data.questions : [];
      const part5Version = part5Data?.version ?? `${questions.length}`;
      await setPart5Cache({ version: part5Version, questions });

      await setDownloadState({ firstDownloadDone: true, vocabVersion: version, part5Version });
      setDownloadProgress(1);
      setDownloadPhase('ready');
      onComplete?.();
    } catch (e) {
      console.error('[offline] download failed', e);
      setDownloadLabel((e instanceof Error ? e.message : 'ダウンロードに失敗しました') + '。ネットワークを確認してください。');
    }
  }, []);

  const skipUpdate = useCallback(() => {
    setDownloadPhase('ready');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await getDownloadState();
      if (cancelled) return;
      if (!state?.firstDownloadDone) {
        setDownloadPhase('first');
        setCanSkipDownload(false);
        setDownloadLabel('初回起動のため、問題データをダウンロードします。');
        return;
      }
      try {
        const res = await fetch('/api/offline-versions', { credentials: 'include' });
        const data = res.ok ? await res.json().catch(() => ({})) : {};
        const serverVocab = String(data.vocabVersion ?? '0');
        const serverPart5 = String(data.part5Version ?? '0');
        const localVocab = state.vocabVersion ?? '';
        const localPart5 = state.part5Version ?? '';
        if (serverVocab !== localVocab || serverPart5 !== localPart5) {
          setDownloadPhase('update');
          setCanSkipDownload(true);
          setDownloadLabel('新しい問題があります。ダウンロードしますか？');
          return;
        }
      } catch {
        // オフライン等
      }
      setDownloadPhase('ready');
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    (async () => {
      const total = await getPendingRunsStaminaTotal();
      setPendingStaminaTotal(total);
    })();
  }, [pendingRunsCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPendingUpdated = () => {
      refreshPendingCount();
      getPendingRunsStaminaTotal().then(setPendingStaminaTotal);
    };
    window.addEventListener('offline-pending-updated', onPendingUpdated);
    return () => window.removeEventListener('offline-pending-updated', onPendingUpdated);
  }, [refreshPendingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => {
      setIsOnline(true);
      syncPendingRuns().then(() => refreshPendingCount());
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncPendingRuns, refreshPendingCount]);

  useEffect(() => {
    if (!isOnline) {
      (async () => {
        const meta = await getStaminaMeta();
        if (meta) {
          const { stamina } = computeCurrentStamina(
            meta.staminaCount,
            meta.lastStaminaAt,
            meta.subscriptionTier,
            meta.evolutionStaminaBonus,
            meta.recoverySpeedMultiplier
          );
          setOfflineStamina(stamina);
          setOfflineMaxStamina(getMaxStamina(meta.subscriptionTier) + meta.evolutionStaminaBonus);
        } else {
          setOfflineStamina(null);
          setOfflineMaxStamina(null);
        }
      })();
    } else {
      setOfflineStamina(null);
      setOfflineMaxStamina(null);
    }
  }, [isOnline]);

  const effectiveOfflineStamina =
    offlineStamina != null && !isOnline
      ? Math.max(0, offlineStamina - pendingStaminaTotal)
      : null;

  const value = useMemo<OfflineContextValue>(
    () => ({
      downloadPhase,
      canSkipDownload,
      downloadProgress,
      downloadLabel,
      runDownload,
      skipUpdate,
      pendingRunsCount,
      syncPendingRuns,
      isOnline,
      effectiveOfflineStamina,
      offlineMaxStamina,
      saveStaminaMeta,
      isOffline: !isOnline,
    }),
    [
      downloadPhase,
      canSkipDownload,
      downloadProgress,
      downloadLabel,
      runDownload,
      skipUpdate,
      pendingRunsCount,
      syncPendingRuns,
      isOnline,
      effectiveOfflineStamina,
      offlineMaxStamina,
      saveStaminaMeta,
    ]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    return {
      downloadPhase: 'ready',
      canSkipDownload: false,
      downloadProgress: 0,
      downloadLabel: '',
      runDownload: async () => {},
      skipUpdate: () => {},
      pendingRunsCount: 0,
      syncPendingRuns: async () => ({ synced: 0 }),
      isOnline: true,
      effectiveOfflineStamina: null,
      offlineMaxStamina: null,
      saveStaminaMeta: async () => {},
      isOffline: false,
    };
  }
  return ctx;
}
