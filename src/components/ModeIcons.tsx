'use client';

/** Part5（文法・品詞）用：ミニマルな文書＋ペン風。高級感のあるラインアイコン */
export function IconPart5({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* 文書 */}
      <path d="M8 6h16l6 6v20H8V6z" />
      <path d="M24 6v6h6" />
      {/* 中央の横線（文法・問題のイメージ） */}
      <path d="M12 16h16" />
      <path d="M12 22h12" />
      <path d="M12 28h10" />
    </svg>
  );
}

/** 単語用：重なった本のミニマルアイコン。背表紙3冊のライン */
export function IconVocab({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M10 8v24a2 2 0 0 0 2 2h2V6h-2a2 2 0 0 0-2 2z" />
      <path d="M16 6v28h2a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2z" />
      <path d="M22 6h2a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2h-2V6z" />
      <path d="M10 8h4M16 8h4M22 8h6" />
    </svg>
  );
}

/** イベント用：カレンダー・星のイメージ */
export function IconEvent({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="6" y="8" width="28" height="24" rx="2" />
      <path d="M6 16h28" />
      <path d="M14 6v4M26 6v4M10 22h4M18 22h4M26 22h4" />
    </svg>
  );
}

/** 大会用：トロフィー風 */
export function IconTournament({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 8h16v10a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V8z" />
      <path d="M8 12v2a2 2 0 0 0 2 2h2M30 12v2a2 2 0 0 1-2 2h-2" />
      <path d="M14 24v4M20 24v8M26 24v4" />
      <path d="M16 36h8" />
    </svg>
  );
}
