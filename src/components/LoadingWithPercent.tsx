'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** 表示テキストのプレフィックス。省略時は「読み込み中」 */
  label?: string;
  /** 追加の class（親でレイアウト用） */
  className?: string;
};

/** 読み込み中にパーセントを表示する共通コンポーネント。0〜90% を約300msごとに更新。 */
export function LoadingWithPercent({ label = '読み込み中', className = '' }: Props) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const step = 10;
    const max = 90;
    const intervalMs = 280;
    const id = setInterval(() => {
      setPercent((p) => (p >= max ? 0 : p + step));
    }, intervalMs);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} role="status" aria-live="polite">
      {label} {percent}%
    </span>
  );
}
