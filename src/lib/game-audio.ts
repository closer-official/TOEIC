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
  bgmMenu: '/sounds/bgm-menu.mp3',
  perfectBonus: '/sounds/perfect-bonus.mp3',
  bossWarning: '/sounds/boss-warning.mp3',
  timeStop: '/sounds/time-stop.mp3',
} as const;

let bgmInstance: HTMLAudioElement | null = null;
let lastBgmPath: string | null = null;

let menuBgmInstance: HTMLAudioElement | null = null;
let menuBgmVolume = 0.35;

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

/** メニュー用BGM（ホーム・ダッシュボード等）。ループ再生。ファイルが無ければ再生しない */
export function playMenuBgmIfExists(volume?: number): void {
  const vol = typeof volume === 'number' ? volume : menuBgmVolume;
  menuBgmVolume = vol;
  if (menuBgmInstance && !menuBgmInstance.paused) {
    menuBgmInstance.volume = vol;
    return;
  }
  if (typeof window === 'undefined') return;
  const path = SOUNDS.bgmMenu;
  fetch(path, { method: 'HEAD' })
    .then((res) => {
      if (!res.ok) return;
      if (menuBgmInstance) {
        menuBgmInstance.pause();
        menuBgmInstance = null;
      }
      menuBgmInstance = new Audio(path);
      menuBgmInstance.volume = vol;
      menuBgmInstance.loop = true;
      menuBgmInstance.play().catch(() => {});
    })
    .catch(() => {});
}

export function stopMenuBgm(): void {
  if (menuBgmInstance) {
    menuBgmInstance.pause();
    menuBgmInstance = null;
  }
}

export function setMenuBgmVolume(volume: number): void {
  menuBgmVolume = Math.max(0, Math.min(1, volume));
  if (menuBgmInstance) menuBgmInstance.volume = menuBgmVolume;
}

/** タブ非表示・アプリ終了時にすべてのBGMを停止（visibilitychange / pagehide で呼ぶ） */
export function stopAllBgmOnHide(): void {
  if (typeof window === 'undefined') return;
  const stop = () => {
    stopBgm();
    stopMenuBgm();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stop();
  });
  window.addEventListener('pagehide', stop);
}

export { SOUNDS };
