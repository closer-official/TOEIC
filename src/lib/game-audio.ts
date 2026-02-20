/**
 * ゲーム用音声。ファイルが存在する場合のみ再生する（差し替え可能）
 * public/sounds/ に配置したファイルを参照
 */

const SOUNDS = {
  comboGreat: '/sounds/combo-great.mp3',
  comboExcellent: '/sounds/combo-excellent.mp3',
  bgmNormal: '/sounds/bgm-normal.mp3',
  bgmUrgent: '/sounds/bgm-urgent.mp3',
  bgmFever: '/sounds/bgm-fever.mp3',
  perfectBonus: '/sounds/perfect-bonus.mp3',
  bossWarning: '/sounds/boss-warning.mp3',
  timeStop: '/sounds/time-stop.mp3',
} as const;

let bgmInstance: HTMLAudioElement | null = null;
let lastBgmPath: string | null = null;

function tryPlay(path: string, volume = 0.7): void {
  if (typeof window === 'undefined') return;
  const audio = new Audio(path);
  audio.volume = volume;
  audio.play().catch(() => {});
}

/** ファイルが存在するか fetch HEAD で確認してから再生（SE用） */
export function playSoundIfExists(key: keyof typeof SOUNDS, volume?: number): void {
  const path = SOUNDS[key];
  fetch(path, { method: 'HEAD' })
    .then((res) => { if (res.ok) tryPlay(path, volume); })
    .catch(() => {});
}

/** BGM を切り替え。path が前回と同じなら何もしない。ファイルがなければ再生しない */
export function playBgmIfExists(key: keyof typeof SOUNDS): void {
  const path = SOUNDS[key];
  if (lastBgmPath === path && bgmInstance && !bgmInstance.paused) return;
  if (typeof window === 'undefined') return;
  fetch(path, { method: 'HEAD' })
    .then((res) => {
      if (!res.ok) return;
      if (bgmInstance) {
        bgmInstance.pause();
        bgmInstance = null;
      }
      bgmInstance = new Audio(path);
      bgmInstance.volume = 0.4;
      bgmInstance.loop = true;
      bgmInstance.play().catch(() => {});
      lastBgmPath = path;
    })
    .catch(() => {});
}

export function stopBgm(): void {
  if (bgmInstance) {
    bgmInstance.pause();
    bgmInstance = null;
  }
  lastBgmPath = null;
}

export { SOUNDS };
