import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '会社概要 | All-in ENGLISH',
  description: 'Closer事務局の会社概要。All-in ENGLISH の運営者情報・所在地・お問い合わせ先。',
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
