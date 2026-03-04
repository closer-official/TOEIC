'use client';

import Link from 'next/link';
import type { FC } from 'react';

/** 左縦: 取引・進化・持物は廃止（ショップに取引、ボトムバーに装備） */
const leftItems: { href: string; label: string; icon: string }[] = [];

function IconEvolution() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function IconInventory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 4.91 8.73-4.91" />
      <path d="M12 12v9.5" />
    </svg>
  );
}

function IconExchange() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 16V4" />
      <path d="M17 8v12" />
      <path d="m17 8 4 4 4-4" />
      <path d="m3 16 4-4-4-4" />
    </svg>
  );
}

type IconComponent = FC;

const leftIconMap: Record<string, IconComponent> = {
  Evolution: IconEvolution,
  Exchange: IconExchange,
  Inventory: IconInventory,
};

function SideLink({
  href,
  label,
  iconKey,
  iconMap,
}: {
  href: string;
  label: string;
  iconKey: string;
  iconMap: Record<string, IconComponent>;
}) {
  const Icon = iconMap[iconKey];
  if (!Icon) return null;
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 rounded-xl border border-gold-subtle bg-black/80 p-2.5 text-zinc-400 transition-colors hover:border-[var(--gold)]/60 hover:bg-zinc-900/90 hover:text-gold-bright"
      title={label}
    >
      <Icon />
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

/** 左固定サイドバー（md以上で表示。スマホでは重なるので非表示） */
export function HomeSideButtons() {
  return (
    <div className="fixed left-2 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 sm:left-4 md:flex">
      {leftItems.map(({ href, label, icon }) => (
        <SideLink key={href} href={href} label={label} iconKey={icon} iconMap={leftIconMap} />
      ))}
    </div>
  );
}

/** 左ナビに項目があるか（空のときホームでナビ領域を非表示にする用） */
export const hasSideNavItems = leftItems.length > 0;

/** スマホ用：ページ内に表示するナビ（Part5・単語と重ならない）。項目なしのときは非表示 */
export function HomeNavInline() {
  if (leftItems.length === 0) return null;
  return (
    <nav className="flex flex-wrap justify-center gap-2 px-2" aria-label="メニュー">
      {leftItems.map(({ href, label, icon }) => (
        <SideLink key={href} href={href} label={label} iconKey={icon} iconMap={leftIconMap} />
      ))}
    </nav>
  );
}
