'use client';

import { useEffect, useState, useRef } from 'react';

/** 1〜6の出目に対応するドット配置（3x3グリッド、0=空き 1=ドット） */
const DICE_DOTS: Record<number, number[]> = {
  1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
  3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
  5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  6: [1, 0, 1, 1, 0, 1, 1, 0, 1],
};

/** 立方体のどの面を手前に見せるか（rotateX, rotateY の deg） */
const CUBE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

const FACE_POSITIONS: { value: number; className: string }[] = [
  { value: 1, className: 'sugoroku-dice-cube-face-front' },
  { value: 6, className: 'sugoroku-dice-cube-face-back' },
  { value: 2, className: 'sugoroku-dice-cube-face-right' },
  { value: 5, className: 'sugoroku-dice-cube-face-left' },
  { value: 3, className: 'sugoroku-dice-cube-face-top' },
  { value: 4, className: 'sugoroku-dice-cube-face-bottom' },
];

function DiceFace({ value }: { value: number }) {
  const dots = DICE_DOTS[value] ?? DICE_DOTS[1];
  return (
    <>
      {dots.map((filled, i) => (
        <span
          key={i}
          className={filled ? 'sugoroku-dice-dot' : 'sugoroku-dice-dot-empty'}
          aria-hidden
        />
      ))}
    </>
  );
}

type Props = {
  isRolling: boolean;
  result: number | null;
  onTap: () => void;
  disabled: boolean;
  goldenValue?: number | null;
};

export function SugorokuDice({ isRolling, result, onTap, disabled, goldenValue }: Props) {
  const [displayValue, setDisplayValue] = useState<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRolling) {
      setDisplayValue((v) => (v % 6) + 1);
      intervalRef.current = setInterval(() => {
        setDisplayValue((v) => {
          const next = Math.floor(Math.random() * 6) + 1;
          return next !== v ? next : (v % 6) + 1;
        });
      }, 80);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }
    if (result !== null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayValue(result);
    }
  }, [isRolling, result]);

  const canTap = !disabled && !isRolling;
  const isGolden = goldenValue != null && goldenValue >= 1 && goldenValue <= 6;
  const rot = CUBE_ROTATION[displayValue] ?? CUBE_ROTATION[1];

  return (
    <button
      type="button"
      onClick={() => canTap && onTap()}
      disabled={!canTap}
      className={`
        relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
        ${!canTap ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-95'}
      `}
      aria-label={isRolling ? '振っています' : result !== null ? `出目 ${result}` : 'サイコロを振る'}
    >
      <div className="sugoroku-dice-scene w-full h-full">
        <div
          className={`sugoroku-dice-cube ${isRolling ? 'sugoroku-dice-cube-rolling' : ''}`}
          style={{
            transform: isRolling
              ? undefined
              : `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          }}
        >
          {FACE_POSITIONS.map(({ value, className }) => (
            <div
              key={className}
              className={`sugoroku-dice-cube-face ${className}`}
            >
              <DiceFace value={value} />
            </div>
          ))}
        </div>
      </div>
      {isGolden && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--gold)]/90 flex items-center justify-center text-[10px] font-bold text-black">
          {goldenValue}
        </span>
      )}
    </button>
  );
}
