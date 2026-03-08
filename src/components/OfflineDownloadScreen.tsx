'use client';

import { useOffline } from '@/lib/offline-context';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

export function OfflineDownloadScreen() {
  const {
    downloadPhase,
    canSkipDownload,
    downloadProgress,
    downloadLabel,
    runDownload,
    skipUpdate,
  } = useOffline();

  if (downloadPhase === 'ready' || downloadPhase === 'idle') return null;

  if (downloadPhase === 'checking') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-zinc-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden />
        <LoadingWithPercent className="text-white" />
      </div>
    );
  }

  if (downloadPhase === 'update') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-zinc-950 px-6">
        <p className="text-center text-white">{downloadLabel}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => runDownload(() => skipUpdate())}
            className="rounded-lg border border-amber-500 bg-amber-500/20 px-6 py-3 text-base font-medium text-amber-400 hover:bg-amber-500/30"
          >
            ダウンロード
          </button>
          <button
            type="button"
            onClick={skipUpdate}
            className="rounded-lg border border-zinc-500 bg-zinc-800 px-6 py-3 text-base font-medium text-zinc-300 hover:bg-zinc-700"
          >
            スキップ
          </button>
        </div>
      </div>
    );
  }

  if (downloadPhase === 'first') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-zinc-950 px-6">
        <p className="text-center text-white">{downloadLabel}</p>
        <div className="w-full max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${Math.round(downloadProgress * 100)}%` }}
            />
          </div>
        </div>
        <p className="text-center text-sm text-zinc-400">初回プレイのためスキップできません</p>
        {downloadProgress <= 0 && (
          <button
            type="button"
            onClick={() => runDownload()}
            className="rounded-lg border border-amber-500 bg-amber-500/20 px-6 py-3 text-base font-medium text-amber-400 hover:bg-amber-500/30"
          >
            ダウンロード開始
          </button>
        )}
      </div>
    );
  }

  return null;
}
