'use client';

import Link from 'next/link';
import { useId } from 'react';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/history', label: '学習記録', icon: 'History' },
  { href: '/guild', label: 'ギルド', icon: 'Guild' },
  { href: '/', label: 'HOME', icon: 'Home' },
  { href: '/inventory', label: '装備', icon: 'Equipment' },
  { href: '/shop', label: 'ショップ', icon: 'Shop' },
] as const;

const BRASS_GRADIENT = {
  id: 'brass-nav',
  stops: [
    { offset: '0%', color: '#C5A059' },
    { offset: '45%', color: '#F9F295' },
    { offset: '100%', color: '#B8860B' },
  ],
};

/** 懐中時計：本体は真円、上部に竜頭と吊り下げ用リング（1px線）・学習記録 */
function IconHistory({ active }: { active: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`brass-h-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
          {BRASS_GRADIENT.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      {/* 吊り下げ用リング（1px線で明確に） */}
      <path d="M12 3.8v.6c0 .9.7 1.6 1.6 1.6.9 0 1.6-.7 1.6-1.6v-.6" fill="none" stroke={`url(#brass-h-${gid})`} strokeWidth="1" strokeLinecap="round" />
      {/* 竜頭（つまみ・Winding knob） */}
      <path d="M11.4 4.2h1.2v1.6h-.4v.8h-.4v-.8h-.4z" fill={`url(#brass-h-${gid})`} />
      <path d="M11.6 4.4h.8v1.2M12 5.2v.6" stroke={`url(#brass-h-${gid})`} strokeWidth="0.5" fill="none" />
      {/* 本体：真円 */}
      <circle cx="12" cy="12.2" r="7.2" fill="none" stroke={`url(#brass-h-${gid})`} strokeWidth="1" />
      {/* 文字盤の縁（内側の円） */}
      <circle cx="12" cy="12.2" r="5.4" fill="none" stroke={`url(#brass-h-${gid})`} strokeWidth="0.5" opacity="0.9" />
      {/* 時刻の針（1px） */}
      <path d="M12 12.2V10M12 12.2l2 1.5" stroke={`url(#brass-h-${gid})`} strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** 封蝋：縁をわざと不規則に波打たせ、中央に剣・盾風紋章の影（彫り込み）・ギルド */
function IconGuild({ active }: { active: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`brass-g-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
          {BRASS_GRADIENT.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
        <filter id={`shadow-g-${gid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0.3" dy="0.4" stdDeviation="0.2" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
      {/* 溶けたロウのように不規則に波打つ外周（ベジェで歪めた円形） */}
      <path
        d="M12 3.2 C 15.5 3 18.5 5.5 18.5 8.5 C 18.5 11.5 16 14 12 14.8 C 8 14 5.5 11.5 5.5 8.5 C 5.5 5.5 8.5 3 12 3.2 Z"
        fill={`url(#brass-g-${gid})`}
      />
      {/* 中央の紋章（盾・剣風）と彫り込みの影 */}
      <g filter={`url(#shadow-g-${gid})`}>
        <path d="M12 7.2v5.6l-2.2-1.8V7.2L12 5.4l2.2 1.8v3.8L12 12.8z" fill={`url(#brass-g-${gid})`} opacity="0.85" />
        <path d="M12 9v2.8M10.2 10.4h3.6" stroke={`url(#brass-g-${gid})`} strokeWidth="0.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/** ドアノッカー：リングは中空（ドーナツ）、台座とリングの重なりにハイライト・HOME */
function IconHome({ active }: { active: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`brass-home-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
          {BRASS_GRADIENT.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      {/* 上部の台座（板） */}
      <path d="M5 4.6h14v2.8H5z" fill={`url(#brass-home-${gid})`} />
      {/* 台座とリングの接合部ハイライト（上縁の光） */}
      <path d="M5 4.6h14v.5H5z" fill="rgba(255,255,255,0.25)" />
      <path d="M6 5.2v1.8h12V5.2H6z" fill="none" stroke={`url(#brass-home-${gid})`} strokeWidth="0.5" />
      {/* 吊り下がるリング：中空（ドーナツ状） */}
      <path
        fillRule="evenodd"
        fill={`url(#brass-home-${gid})`}
        d="M12 8.6 A 3.6 3.6 0 0 1 12 16 A 3.6 3.6 0 0 1 12 8.6 Z M12 10.2 A 2 2 0 0 1 12 14.4 A 2 2 0 0 1 12 10.2 Z"
      />
      {/* リング上部のハイライト（台座との重なり） */}
      <path d="M8.6 8.6 Q 12 7 15.4 8.6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeLinecap="round" />
    </svg>
  );
}

/** ジュエリーボックス：前面の鍵穴と蓋の厚みを視認可能に・装備 */
function IconEquipment({ active }: { active: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`brass-e-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
          {BRASS_GRADIENT.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      {/* 箱本体 */}
      <path d="M4 11.4v7.8h16v-7.8H4z" fill={`url(#brass-e-${gid})`} />
      <path d="M4 11.4h16v1H4z" fill="none" stroke={`url(#brass-e-${gid})`} strokeWidth="0.5" />
      {/* 蓋（厚みを上面で表現） */}
      <path d="M5 8.2v2.6h14V8.2c0-.8-.65-1.5-1.5-1.5h-11c-.85 0-1.5.7-1.5 1.5z" fill={`url(#brass-e-${gid})`} />
      <path d="M5 8.2h14v.5H5z" fill="rgba(255,255,255,0.15)" />
      <path d="M5.5 8.8v1.8h13V8.8h-13z" fill="none" stroke={`url(#brass-e-${gid})`} strokeWidth="0.5" />
      {/* 前面の鍵穴（keyhole） */}
      <path d="M10.8 13h2.4v2.4h-2.4z" fill={`url(#brass-e-${gid})`} />
      <path d="M11.2 13v.8c0 .25.2.45.45.45h.7c.25 0 .45-.2.45-.45V13" fill="none" stroke={`url(#brass-e-${gid})`} strokeWidth="0.5" />
      <circle cx="12" cy="15" r="0.5" fill={`url(#brass-e-${gid})`} />
      {/* 蓋上の宝石 */}
      <path d="M11.4 7.2l.6.9.6-.9v1.2h-1.2V7.2z" fill={`url(#brass-e-${gid})`} />
    </svg>
  );
}

/** 小銭入れ：金属製の留め玉（2つの丸）をハッキリ描写・ショップ */
function IconShop({ active }: { active: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`brass-s-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
          {BRASS_GRADIENT.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      {/* がま口の袋本体 */}
      <path d="M5.2 10.8c0-2 2-3.6 4.4-3.6s4.4 1.6 4.4 3.6v5.4c0 2-2 3.6-4.4 3.6s-4.4-1.6-4.4-3.6v-5.4z" fill={`url(#brass-s-${gid})`} opacity="0.7" />
      <path d="M6.8 10.8c0-1.2 1.2-2.2 2.6-2.2s2.6 1 2.6 2.2v4.6c0 1.2-1.2 2.2-2.6 2.2s-2.6-1-2.6-2.2V10.8z" fill="none" stroke={`url(#brass-s-${gid})`} strokeWidth="0.6" />
      {/* 金属製の留め玉（2つ・はっきり） */}
      <path d="M8.8 8a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0 -2.8 0z" fill={`url(#brass-s-${gid})`} />
      <path d="M13.2 8a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0 -2.8 0z" fill={`url(#brass-s-${gid})`} />
      <path d="M9.4 7.6a.9.9 0 1 0 1.8 0 .9.9 0 1 0 -1.8 0z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.35" />
      <path d="M13.8 7.6a.9.9 0 1 0 1.8 0 .9.9 0 1 0 -1.8 0z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.35" />
      {/* 口金の中央 */}
      <path d="M10.2 7.6h3.6v1.2h-3.6z" fill={`url(#brass-s-${gid})`} />
    </svg>
  );
}

const iconMap = {
  History: IconHistory,
  Guild: IconGuild,
  Home: IconHome,
  Shop: IconShop,
  Equipment: IconEquipment,
};

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bottom-nav-bar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 safe-area-bottom"
      aria-label="メインメニュー"
    >
      {items.map(({ href, label, icon: iconKey }) => {
        const Icon = iconMap[iconKey];
        const path = href.split('?')[0];
        const active = path === '/' ? pathname === '/' : pathname.startsWith(path);
        return (
          <Link
            key={href}
            href={href}
            className="bottom-nav-link flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-all duration-200 touch-target"
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={`bottom-nav-icon flex h-8 w-8 items-center justify-center transition-all duration-200 ${
                active ? 'bottom-nav-icon-active' : 'bottom-nav-icon-inactive'
              }`}
            >
              <Icon active={active} />
            </span>
            <span className="bottom-nav-label text-[10px] font-medium leading-none">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
