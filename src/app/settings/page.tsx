'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

type KeyBindings = { topLeft: string; bottomLeft: string; topRight: string; bottomRight: string };

type ProfileForm = {
  avatar_url: string;
  username: string;
  current_toeic_score: string;
  target_toeic_score: string;
  next_exam_date: string;
  referrer_id: string;
};

const initialProfile: ProfileForm = {
  avatar_url: '',
  username: '',
  current_toeic_score: '',
  target_toeic_score: '',
  next_exam_date: '',
  referrer_id: '',
};

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string; avatarUrl: string | null } | null | 'loading'>('loading');
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPc, setIsPc] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [keyBindings, setKeyBindings] = useState<KeyBindings>({
    topLeft: 's',
    bottomLeft: 'd',
    topRight: 'j',
    bottomRight: 'k',
  });
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setSession(null);
        return;
      }
      const avatarUrl =
        (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
      setSession({ id: u.id, avatarUrl });
    });
  }, []);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session, router]);

  useEffect(() => {
    if (session === 'loading' || !session || typeof session !== 'object') return;
    setProfileLoading(true);
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProfile({
            avatar_url: d.avatar_url ?? '',
            username: d.username ?? '',
            current_toeic_score: d.current_toeic_score != null ? String(d.current_toeic_score) : '',
            target_toeic_score: d.target_toeic_score != null ? String(d.target_toeic_score) : '',
            next_exam_date: d.next_exam_date ?? '',
            referrer_id: d.referrer_id ?? '',
          });
        }
      })
      .finally(() => setProfileLoading(false));
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const wide = window.innerWidth >= 768;
    setIsPc(fine);
    setIsDesktop(fine && wide);
  }, []);

  useEffect(() => {
    if (session !== 'loading' && session && typeof session === 'object') {
      fetch('/api/key-bindings')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setKeyBindings(d))
        .catch(() => {});
    }
  }, [session]);

  const saveProfile = useCallback(async () => {
    if (session === 'loading' || !session || typeof session !== 'object') return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profile.username.trim(),
          current_toeic_score: profile.current_toeic_score.trim(),
          target_toeic_score: profile.target_toeic_score.trim(),
          next_exam_date: profile.next_exam_date.trim(),
          referrer_id: profile.referrer_id.trim(),
          avatar_url: profile.avatar_url.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setProfileMsg({ type: 'ok', text: '保存しました' });
        await createClient().auth.refreshSession();
        const { data } = await createClient().auth.getSession();
        if (data.session?.user) {
          const u = data.session.user;
          const avatarUrl = (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
          setSession({ id: u.id, avatarUrl });
        }
      } else {
        setProfileMsg({ type: 'err', text: j.error ?? '保存に失敗しました' });
      }
    } catch {
      setProfileMsg({ type: 'err', text: '保存に失敗しました' });
    } finally {
      setProfileSaving(false);
    }
  }, [session, profile]);

  const saveKeyBindings = useCallback(async () => {
    setKeyLoading(true);
    setKeyMsg(null);
    try {
      const res = await fetch('/api/key-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyBindings),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setKeyMsg('保存しました');
      } else {
        setKeyMsg(j.error ?? '保存に失敗しました');
      }
    } catch {
      setKeyMsg('保存に失敗しました');
    } finally {
      setKeyLoading(false);
    }
  }, [keyBindings]);

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" aria-hidden />
        <LoadingWithPercent className="text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">設定</h1>

          {/* プロフィール */}
          <section className="mt-6 rounded-2xl border border-gold-subtle bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-300">プロフィール</h2>
            {profileLoading ? (
              <LoadingWithPercent className="mt-3 block text-sm text-zinc-500" />
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-4">
                  {/* プロフィール画像 */}
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-xs text-zinc-500">プロフィール画像</span>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gold-subtle bg-zinc-800">
                        {profile.avatar_url.trim() ? (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : typeof session === 'object' && session?.avatarUrl ? (
                          <img
                            src={session.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xl text-zinc-400">
                            ?
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 min-w-0">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          id="avatar-upload"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setAvatarUploading(true);
                            setProfileMsg(null);
                            try {
                              const form = new FormData();
                              form.append('file', f);
                              const res = await fetch('/api/upload/avatar', { method: 'POST', body: form, credentials: 'include' });
                              const j = await res.json().catch(() => ({}));
                              if (res.ok && j.url) {
                                setProfile((p) => ({ ...p, avatar_url: j.url }));
                                const saveRes = await fetch('/api/profile', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ...profile, avatar_url: j.url }),
                                  credentials: 'include',
                                });
                                if (saveRes.ok) {
                                  setProfileMsg({ type: 'ok', text: '画像を更新しました' });
                                  await createClient().auth.refreshSession();
                                }
                              } else {
                                setProfileMsg({ type: 'err', text: j.error ?? 'アップロードに失敗しました' });
                              }
                            } catch {
                              setProfileMsg({ type: 'err', text: 'アップロードに失敗しました' });
                            } finally {
                              setAvatarUploading(false);
                              e.target.value = '';
                            }
                          }}
                        />
                        <label
                          htmlFor="avatar-upload"
                          className="cursor-pointer rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
                        >
                          {avatarUploading ? 'アップロード中…' : '写真から選択'}
                        </label>
                        <input
                          type="url"
                          placeholder="画像URL（任意）"
                          value={profile.avatar_url}
                          onChange={(e) => setProfile((p) => ({ ...p, avatar_url: e.target.value }))}
                          className="w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/60 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <label className="block">
                    <span className="block text-xs text-zinc-500">ユーザー名（ランキング表示）</span>
                    <input
                      type="text"
                      placeholder="表示名"
                      value={profile.username}
                      onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/60 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-zinc-500">TOEIC 現在の得点</span>
                    <input
                      type="number"
                      min={0}
                      max={990}
                      placeholder="例: 650"
                      value={profile.current_toeic_score}
                      onChange={(e) => setProfile((p) => ({ ...p, current_toeic_score: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/60 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-zinc-500">TOEIC 目標得点</span>
                    <input
                      type="number"
                      min={0}
                      max={990}
                      placeholder="例: 800"
                      value={profile.target_toeic_score}
                      onChange={(e) => setProfile((p) => ({ ...p, target_toeic_score: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/60 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-zinc-500">次の受験日</span>
                    <input
                      type="date"
                      value={profile.next_exam_date}
                      onChange={(e) => setProfile((p) => ({ ...p, next_exam_date: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white focus:border-[var(--gold)]/60 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-zinc-500">紹介者コード</span>
                    <input
                      type="text"
                      placeholder="紹介者のコード"
                      value={profile.referrer_id}
                      onChange={(e) => setProfile((p) => ({ ...p, referrer_id: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/60 focus:outline-none"
                    />
                  </label>
                </div>
                {profileMsg && (
                  <p className={`mt-3 text-sm ${profileMsg.type === 'err' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {profileMsg.text}
                  </p>
                )}
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="mt-3 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
                >
                  {profileSaving ? '保存中…' : '保存'}
                </button>
              </>
            )}
          </section>

          {isDesktop && (
            <section className="mt-6 rounded-2xl border border-gold-subtle bg-zinc-900/80 p-4">
              <h2 className="text-sm font-medium text-zinc-300">キーバインド（PC版）</h2>
              <p className="mt-1 text-xs text-zinc-500">
                解答の4択にキーを割り当て。ゲーム中にそのキーを押すと対応する選択肢を選べます。
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
                  <span className="block text-xs text-zinc-500">左上</span>
                  <input
                    type="text"
                    maxLength={1}
                    value={keyBindings.topLeft}
                    onChange={(e) => setKeyBindings((k) => ({ ...k, topLeft: e.target.value.toLowerCase() || 's' }))}
                    className="mt-1 w-12 rounded border border-gold-subtle bg-zinc-800 px-2 py-1 text-center font-mono text-white focus:border-[var(--gold)]/60 focus:outline-none"
                  />
                </label>
                <label className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
                  <span className="block text-xs text-zinc-500">右上</span>
                  <input
                    type="text"
                    maxLength={1}
                    value={keyBindings.topRight}
                    onChange={(e) => setKeyBindings((k) => ({ ...k, topRight: e.target.value.toLowerCase() || 'j' }))}
                    className="mt-1 w-12 rounded border border-gold-subtle bg-zinc-800 px-2 py-1 text-center font-mono text-white focus:border-[var(--gold)]/60 focus:outline-none"
                  />
                </label>
                <label className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
                  <span className="block text-xs text-zinc-500">左下</span>
                  <input
                    type="text"
                    maxLength={1}
                    value={keyBindings.bottomLeft}
                    onChange={(e) => setKeyBindings((k) => ({ ...k, bottomLeft: e.target.value.toLowerCase() || 'd' }))}
                    className="mt-1 w-12 rounded border border-gold-subtle bg-zinc-800 px-2 py-1 text-center font-mono text-white focus:border-[var(--gold)]/60 focus:outline-none"
                  />
                </label>
                <label className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
                  <span className="block text-xs text-zinc-500">右下</span>
                  <input
                    type="text"
                    maxLength={1}
                    value={keyBindings.bottomRight}
                    onChange={(e) => setKeyBindings((k) => ({ ...k, bottomRight: e.target.value.toLowerCase() || 'k' }))}
                    className="mt-1 w-12 rounded border border-gold-subtle bg-zinc-800 px-2 py-1 text-center font-mono text-white focus:border-[var(--gold)]/60 focus:outline-none"
                  />
                </label>
              </div>
              {keyMsg && <p className={`mt-3 text-sm ${keyMsg.includes('失敗') ? 'text-red-400' : 'text-emerald-400'}`}>{keyMsg}</p>}
              <button
                type="button"
                onClick={saveKeyBindings}
                disabled={keyLoading}
                className="mt-3 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
              >
                保存
              </button>
            </section>
          )}

          {/* ログアウト・退会 */}
          <section className="mt-6 rounded-2xl border border-gold-subtle bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-300">アカウント</h2>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  await createClient().auth.signOut();
                  router.push('/login');
                }}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
              >
                ログアウト
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('退会するとアカウントとすべてのデータが即座に削除されます。復元できません。本当に退会しますか？')) return;
                  try {
                    const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' });
                    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                    if (!res.ok) {
                      alert(data.error ?? '退会処理に失敗しました。');
                      return;
                    }
                    await createClient().auth.signOut();
                  } catch {
                    // 削除成功後にセッションが無効でも signOut でエラーになることがある
                  }
                  router.push('/login');
                }}
                className="rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900/30"
              >
                退会
              </button>
            </div>
          </section>

          <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-zinc-400">
            <Link href="/about" className="hover:text-zinc-300">会社概要</Link>
            <span aria-hidden className="text-zinc-600">|</span>
            <Link href="/faq" className="hover:text-zinc-300">よくある質問</Link>
            <span aria-hidden className="text-zinc-600">|</span>
            <Link href="/terms" className="hover:text-zinc-300">利用規約</Link>
            <span aria-hidden className="text-zinc-600">|</span>
            <Link href="/privacy" className="hover:text-zinc-300">プライバシーポリシー</Link>
            <span aria-hidden className="text-zinc-600">|</span>
            <Link href="/tokusho" className="hover:text-zinc-300">特定商取引法に基づく表記</Link>
          </nav>

          <p className="mt-8 text-center">
            <Link href="/" className="text-sm text-gold hover:text-gold-bright">
              ← ホームへ
            </Link>
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
