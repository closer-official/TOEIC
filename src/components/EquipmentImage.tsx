'use client';

import { useState, useCallback, useEffect } from 'react';
import { getEquipmentImagePath, type EquipmentGrade } from '@/lib/equipment-items';

type Props = {
  equipmentId: string;
  grade?: EquipmentGrade | string | null;
  alt?: string;
  className?: string;
  size?: number;
  /** 画像読み込み失敗時に ? を表示する場合は true（デフォルト） */
  showFallbackChar?: boolean;
};

/**
 * 装備画像（PNGのみ）。グレード指定時は {id}_{grade}.png、失敗時は {id}.png にフォールバック。
 * コモン→ノーマル等に進化すると grade が変わるので、対応する画像に切り替わる。
 */
export function EquipmentImage({
  equipmentId,
  grade,
  alt = '',
  className = '',
  size,
  showFallbackChar = true,
}: Props) {
  const [src, setSrc] = useState(() => getEquipmentImagePath(equipmentId, grade));
  const [triedJpg, setTriedJpg] = useState(false);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setSrc(getEquipmentImagePath(equipmentId, grade));
    setTriedJpg(false);
    setFallbackUsed(false);
    setError(false);
  }, [equipmentId, grade]);

  const handleError = useCallback(() => {
    // .png で 404 のときは .jpg を試す（実ファイルが JPG の場合に対応）
    if (src.endsWith('.png') && !triedJpg) {
      setSrc(src.replace(/\.png$/, '.jpg'));
      setTriedJpg(true);
      return;
    }
    if (!fallbackUsed) {
      // グレード付きが失敗したので、グレードなしパスを試す
      setSrc(getEquipmentImagePath(equipmentId, null));
      setFallbackUsed(true);
      setTriedJpg(false);
    } else {
      // グレードなし .png の次に .jpg を試す
      if (src.endsWith('.png') && !triedJpg) {
        setSrc(src.replace(/\.png$/, '.jpg'));
        setTriedJpg(true);
      } else {
        setError(true);
      }
    }
  }, [equipmentId, src, triedJpg, fallbackUsed]);

  const style = size != null ? { width: size, height: size } : undefined;

  if (error && showFallbackChar) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-zinc-700/80 text-4xl font-bold text-amber-400 ${className}`}
        style={style}
        aria-hidden
      >
        ?
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain ${className}`}
      style={style}
      onError={handleError}
    />
  );
}
