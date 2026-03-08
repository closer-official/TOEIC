'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

type Guild = {
  id: string;
  name: string;
  leader_comment: string | null;
  emblem_url: string | null;
  level: number;
  total_donated_xp: number;
  join_type: string;
  invite_code?: string | null;
  tags: string[];
  leader_id: string;
  memberCount?: number;
  lab_stamina_lv?: number;
  lab_xp_lv?: number;
  lab_score_lv?: number;
  guild_carry_stamina?: number;
  guild_carry_xp?: number;
  guild_carry_score?: number;
};

type Membership = {
  guild_id: string;
  role: string;
  donated_xp: number;
  questions_this_week: number;
};

type Member = {
  user_id: string;
  username?: string;
  role: string;
  donated_xp: number;
  questions_this_week: number;
  joined_at: string;
};

type TabId = 'chat' | 'members' | 'lab' | 'ranking' | 'search' | 'settings';

type GuildRankRow = {
  id: string;
  name: string;
  emblem_url: string | null;
  level: number;
  leader_id: string;
  memberCount: number;
  weekly_score: number;
};

const GUILD_TAGS = [
  { id: 'ガチ勉強勢', label: 'ガチ勉強勢' },
  { id: '博打大好き勢', label: '博打大好き勢' },
  { id: 'まったり勢', label: 'まったり勢' },
];

/** ギルド設立に必要な全共通XP */
const GUILD_CREATE_XP_COST = 30_000;

export default function GuildPage() {
  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userGuildXp, setUserGuildXp] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>('chat');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchGuild = useCallback(async () => {
    const res = await fetch('/api/guild', { credentials: 'include' });
    if (!res.ok) {
      setGuild(null);
      setMembership(null);
      setMembers([]);
      setUserGuildXp(null);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setGuild(data.guild ?? null);
    setMembership(data.membership ?? null);
    setMembers(data.members ?? []);
    setUserGuildXp(typeof data.userGuildXp === 'number' ? data.userGuildXp : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGuild();
  }, [fetchGuild]);

  // 取引でギルドXP交換したあとなど、画面に戻ったときに最新の所持ギルドXPを反映
  useEffect(() => {
    const onFocus = () => fetchGuild();
    if (typeof window === 'undefined') return;
    window.addEventListener('focus', onFocus);
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchGuild(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchGuild]);

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  const inGuild = !!guild && !!membership;
  const isLeader = membership?.role === 'leader';
  const tabs: { id: TabId; label: string }[] = inGuild
    ? [
        { id: 'chat', label: 'チャット' },
        { id: 'members', label: 'メンバー' },
        { id: 'lab', label: '研究室' },
        { id: 'ranking', label: 'ギルドランキング' },
        { id: 'search', label: '検索' },
        ...(isLeader ? [{ id: 'settings', label: '設定' } as const] : []),
      ]
    : [
        { id: 'ranking', label: 'ギルドランキング' },
        { id: 'search', label: 'ギルド検索' },
      ];

  useEffect(() => {
    if (!inGuild && tab !== 'search' && tab !== 'ranking') setTab('search');
    if (inGuild && !isLeader && tab === 'settings') setTab('chat');
  }, [inGuild, isLeader, tab]);

  if (loading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        <h1 className="text-xl font-bold text-white">ギルド</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {inGuild
            ? 'メンバーと一緒に研究室・チャットで盛り上がろう。'
            : 'ギルドに参加するか、新規作成して仲間を集めよう。'}
        </p>
        {userGuildXp !== null && (
          <p className="mt-1 text-sm text-amber-400/90">
            所持ギルドXP: <span className="font-semibold text-white">{userGuildXp.toLocaleString()}</span>
          </p>
        )}

        {/* ギルドカード（所属時）・設定フォームは「設定」タブで表示 */}
        {inGuild ? (
          <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
            <GuildDashboard guild={guild!} membership={membership!} onLeave={fetchGuild} setMsg={setMsg} showLeaderForms={false} />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4 text-center">
            <p className="text-zinc-300">ギルドに参加していません</p>
            <p className="mt-1 text-sm text-zinc-500">下の「ギルド検索」で参加するか、新規作成（30,000 ギルドXP）してください。</p>
          </div>
        )}

        {/* タブ（進化・取引と同じスタイル） */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* メインエリア */}
        <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          {tab === 'chat' && inGuild && <MainAreaActivityAndChat setMsg={setMsg} />}
          {tab === 'members' && inGuild && <MembersTab members={members} guild={guild!} membership={membership!} onUpdate={fetchGuild} setMsg={setMsg} />}
          {tab === 'lab' && inGuild && membership && <LabTab guild={guild!} membership={membership} onEvolve={fetchGuild} setMsg={setMsg} />}
          {tab === 'ranking' && <GuildRankingTab myGuildId={guild?.id ?? null} />}
          {tab === 'search' && (
            <SearchTab inGuild={inGuild} onJoin={fetchGuild} setMsg={setMsg} userGuildXp={userGuildXp} />
          )}
          {tab === 'settings' && inGuild && isLeader && guild && (
            <SettingsTab
              guild={guild}
              membership={membership!}
              onLeave={fetchGuild}
              setMsg={setMsg}
              tabs={tabs.filter((t) => t.id !== 'settings')}
              currentTab={tab}
              setTab={setTab}
            />
          )}
        </div>
      </main>

      {msg && (
        <div
          className={`fixed bottom-24 left-4 right-4 mx-auto max-w-md rounded-lg px-4 py-2 text-sm text-center z-10 ${
            msg.type === 'ok' ? 'bg-emerald-900/90 text-emerald-200' : 'bg-red-900/90 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}
      <BottomNav />
    </div>
  );
}

function GuildDashboard({
  guild,
  membership,
  onLeave,
  setMsg,
  showLeaderForms = false,
  showCard = true,
}: {
  guild: Guild;
  membership: Membership;
  onLeave: () => void;
  setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void;
  showLeaderForms?: boolean;
  /** ギルドカード（アイコン・名前・バフ）を表示するか。設定タブ内では false で別表示 */
  showCard?: boolean;
}) {
  const [leaving, setLeaving] = useState(false);
  const [emblemUrl, setEmblemUrl] = useState(guild.emblem_url ?? '');
  const [emblemSaving, setEmblemSaving] = useState(false);
  const [editName, setEditName] = useState(guild.name);
  const [editComment, setEditComment] = useState(guild.leader_comment ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const isLeader = membership.role === 'leader';

  useEffect(() => {
    setEmblemUrl(guild.emblem_url ?? '');
  }, [guild.emblem_url]);
  useEffect(() => {
    setEditName(guild.name);
    setEditComment(guild.leader_comment ?? '');
  }, [guild.name, guild.leader_comment]);

  const handleSaveEmblem = async () => {
    if (!isLeader) return;
    setEmblemSaving(true);
    try {
      const res = await fetch('/api/guild', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emblem_url: emblemUrl.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '保存に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: 'ギルドアイコンを更新しました' });
      onLeave();
    } finally {
      setEmblemSaving(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('本当にギルドから脱退しますか？')) return;
    setLeaving(true);
    try {
      const res = await fetch('/api/guild/leave', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '脱退に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: '脱退しました' });
      onLeave();
    } finally {
      setLeaving(false);
    }
  };

  return (
  <>
    {showCard && (
    <div className="flex flex-wrap items-start gap-4">
      {guild.emblem_url ? (
        <img src={guild.emblem_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-zinc-800" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-gold-subtle/40 flex items-center justify-center text-xl font-bold text-zinc-500" title="ギルドアイコン未設定">{(guild.name || 'G').charAt(0)}</div>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-white truncate">{guild.name}</h2>
        <p className="text-zinc-400 text-sm mt-0.5">
          Lv.{guild.level} · メンバー {guild.memberCount ?? 0}人 / 最大{10 + (guild.lab_score_lv ?? 0) * 2}人 · ギルドXP {guild.total_donated_xp.toLocaleString()}
        </p>
        {guild.leader_comment && (
          <p className="text-zinc-300 text-sm mt-2 italic">&quot;{guild.leader_comment}&quot;</p>
        )}
        <p className="text-gold text-xs mt-1">
          ギルドバフ: スタミナ上限+{(guild.lab_stamina_lv ?? 0) * 5} · XP倍率+{(guild.lab_xp_lv ?? 0)}% · 人数上限{10 + (guild.lab_score_lv ?? 0) * 2}人
        </p>
        {isLeader && guild.join_type === 'invite' && guild.invite_code && (
          <p className="text-zinc-400 text-xs mt-1">
            招待コード: <code className="rounded bg-zinc-800 px-1 font-mono">{guild.invite_code}</code>（招待制の参加に必要）
          </p>
        )}
      </div>
      {(membership.role === 'member' || membership.role === 'officer') && (
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-red-400 disabled:opacity-50"
        >
          {leaving ? '脱退中...' : '脱退'}
        </button>
      )}
    </div>
    )}
    {showLeaderForms && isLeader && (
      <>
      <div className="mt-4 rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
        <p className="text-xs font-medium text-zinc-400 mb-2">ギルド名・説明文</p>
        <p className="text-zinc-500 text-xs mb-2">ギルド名は20文字、説明文は100文字以内です。</p>
        <div className="space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value.slice(0, 20))}
            placeholder="ギルド名"
            maxLength={20}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <p className="text-xs text-zinc-500">{editName.length}/20</p>
          <textarea
            value={editComment}
            onChange={(e) => setEditComment(e.target.value.slice(0, 100))}
            placeholder="説明文（任意）"
            maxLength={100}
            rows={2}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none"
          />
          <p className="text-xs text-zinc-500">{editComment.length}/100</p>
          <button
            type="button"
            disabled={profileSaving}
            onClick={async () => {
              const name = editName.trim();
              if (!name) {
                setMsg({ type: 'err', text: 'ギルド名を1文字以上入力してください' });
                return;
              }
              setProfileSaving(true);
              try {
                const res = await fetch('/api/guild', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ name, leaderComment: editComment.trim() || undefined }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setMsg({ type: 'err', text: data?.error ?? '保存に失敗しました' });
                  return;
                }
                setMsg({ type: 'ok', text: 'ギルド名・説明文を更新しました' });
                onLeave();
              } finally {
                setProfileSaving(false);
              }
            }}
            className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-2 text-sm text-gold disabled:opacity-50"
          >
            {profileSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
        <p className="text-xs font-medium text-zinc-400 mb-2">ギルド解散</p>
        <p className="text-zinc-500 text-xs mb-2">解散するとギルドとメンバー情報は削除されます。設立に使ったギルドXPは返還されません。</p>
        <button
          type="button"
          onClick={async () => {
            if (!confirm('本当にギルドを解散しますか？設立に使ったギルドXPは返還されません。')) return;
            const res = await fetch('/api/guild/disband', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) {
              setMsg({ type: 'err', text: data?.error ?? '解散に失敗しました' });
              return;
            }
            setMsg({ type: 'ok', text: 'ギルドを解散しました' });
            onLeave();
          }}
          className="rounded-lg border border-red-500/50 bg-red-900/30 px-3 py-2 text-sm text-red-300 hover:bg-red-900/50"
        >
          ギルドを解散する
        </button>
      </div>
      <div className="mt-4 rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
        <p className="text-xs font-medium text-zinc-400 mb-2">ギルドアイコン</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            id="guild-emblem-upload"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setEmblemSaving(true);
              try {
                const form = new FormData();
                form.append('file', f);
                const res = await fetch('/api/upload/guild-emblem', { method: 'POST', body: form, credentials: 'include' });
                const j = await res.json().catch(() => ({}));
                if (res.ok && j.url) {
                  setEmblemUrl(j.url);
                  const patchRes = await fetch('/api/guild', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ emblem_url: j.url }),
                  });
                  if (patchRes.ok) { /* 保存完了 */ }
                }
              } finally {
                setEmblemSaving(false);
                e.target.value = '';
              }
            }}
          />
          <label
            htmlFor="guild-emblem-upload"
            className="cursor-pointer rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
          >
            {emblemSaving ? 'アップロード中...' : '写真から選択'}
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={emblemUrl}
            onChange={(e) => setEmblemUrl(e.target.value)}
            placeholder="または画像URL"
            className="flex-1 min-w-0 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={handleSaveEmblem}
            disabled={emblemSaving}
            className="shrink-0 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-2 text-sm text-gold disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
      </>
    )}
  </>
  );
}

/** 設定タブ: ギルドカード → 選択ボタン → ギルド名・アイコン・解散フォーム */
function SettingsTab({
  guild,
  membership,
  onLeave,
  setMsg,
  tabs,
  currentTab,
  setTab,
}: {
  guild: Guild;
  membership: Membership;
  onLeave: () => void;
  setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void;
  tabs: { id: TabId; label: string }[];
  currentTab: TabId;
  setTab: (t: TabId) => void;
}) {
  return (
    <div className="space-y-4">
      {/* ギルドカード（3枚目イメージ） */}
      <div className="flex flex-wrap items-start gap-4 rounded-lg border border-gold-subtle bg-zinc-800/60 p-3">
        {guild.emblem_url ? (
          <img src={guild.emblem_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-zinc-800" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-gold-subtle/40 flex items-center justify-center text-xl font-bold text-zinc-500" title="ギルドアイコン未設定">{(guild.name || 'G').charAt(0)}</div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white truncate">{guild.name}</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            Lv.{guild.level} · メンバー {guild.memberCount ?? 0}人 / 最大{10 + (guild.lab_score_lv ?? 0) * 2}人 · ギルドXP {guild.total_donated_xp.toLocaleString()}
          </p>
          {guild.leader_comment && (
            <p className="text-zinc-300 text-sm mt-2 italic">&quot;{guild.leader_comment}&quot;</p>
          )}
          <p className="text-gold text-xs mt-1">
            ギルドバフ: スタミナ上限+{(guild.lab_stamina_lv ?? 0) * 5} · XP倍率+{(guild.lab_xp_lv ?? 0)}% · 人数上限{10 + (guild.lab_score_lv ?? 0) * 2}人
          </p>
        </div>
      </div>
      {/* 選択ボタン（チャット・メンバー等） */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentTab === t.id ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* 設定フォーム（ギルド名・アイコン・解散） */}
      <GuildDashboard guild={guild} membership={membership} onLeave={onLeave} setMsg={setMsg} showLeaderForms showCard={false} />
    </div>
  );
}

type ChatMessage = {
  id: string;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
};

function MainAreaActivityAndChat({ setMsg }: { setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/guild/chat', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.messages)) {
      setMessages(data.messages);
    } else {
      setMessages([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim().slice(0, 500);
    if (!text || sending) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/guild/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '送信に失敗しました' });
        return;
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">ギルドチャット</h3>
      <p className="text-zinc-500 text-xs">500文字以内。メンバー全員が閲覧・投稿できます。</p>
      <div className="rounded-lg border border-gold-subtle bg-zinc-800/80 flex flex-col min-h-[200px] max-h-[320px]">
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[140px]">
          {loading ? (
            <LoadingWithPercent className="block text-sm text-zinc-500" />
          ) : messages.length === 0 ? (
            <p className="text-zinc-500 text-sm">まだメッセージがありません。最初の一言を送ろう。</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="rounded bg-zinc-900/80 px-2 py-1.5 text-sm">
                <p className="text-zinc-400 text-xs">
                  <span className="font-medium text-gold">{m.username}</span>
                  <span className="ml-2 text-zinc-500">
                    {new Date(m.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
                <p className="text-white mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleSend} className="flex gap-2 p-2 border-t border-gold-subtle/50">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            placeholder="メッセージを入力..."
            maxLength={500}
            className="flex-1 min-w-0 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-2 text-sm font-medium text-gold disabled:opacity-50"
          >
            {sending ? '送信中...' : '送信'}
          </button>
        </form>
      </div>
      <p className="text-zinc-500 text-xs">{input.length}/500</p>
    </div>
  );
}

type JoinRequest = { id: string; user_id: string; username?: string; status: string; created_at: string };

function MembersTab({
  members,
  guild,
  membership,
  onUpdate,
  setMsg,
}: {
  members: Member[];
  guild: Guild;
  membership: Membership;
  onUpdate: () => void;
  setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void;
}) {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const isLeader = membership.role === 'leader';
  const isLeaderOrOfficer = membership.role === 'leader' || membership.role === 'officer';

  useEffect(() => {
    if (!isLeaderOrOfficer) return;
    setLoadingRequests(true);
    fetch('/api/guild/join-requests', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => setJoinRequests(Array.isArray(d.requests) ? d.requests : []))
      .finally(() => setLoadingRequests(false));
  }, [isLeaderOrOfficer, members.length]);

  const roleLabel = (r: string) => (r === 'leader' ? 'リーダー' : r === 'officer' ? '幹部' : 'メンバー');
  const officerCount = members.filter((m) => m.role === 'officer').length;
  const sorted = [...members].sort((a, b) => {
    const order = { leader: 0, officer: 1, member: 2 };
    return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2);
  });

  const handleApproveReject = async (requestId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/guild/join-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requestId, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: 'err', text: data?.error ?? '処理に失敗しました' });
      return;
    }
    setMsg({ type: 'ok', text: data?.message ?? (action === 'approve' ? '承認しました' : '却下しました') });
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    onUpdate();
  };

  const handleOfficer = async (userId: string, action: 'appoint' | 'dismiss') => {
    const res = await fetch('/api/guild/officer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: 'err', text: data?.error ?? '処理に失敗しました' });
      return;
    }
    setMsg({ type: 'ok', text: data?.message ?? '更新しました' });
    onUpdate();
  };

  return (
    <div className="space-y-4">
      {isLeaderOrOfficer && joinRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">参加申請</h3>
          <ul className="space-y-2">
            {joinRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-gold-subtle bg-zinc-800/80 px-3 py-2">
                <span className="text-zinc-300 text-sm">{r.username ?? `ID: ${r.user_id.slice(0, 8)}…`}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleApproveReject(r.id, 'approve')}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveReject(r.id, 'reject')}
                    className="rounded bg-zinc-600 px-2 py-1 text-xs text-zinc-300"
                  >
                    却下
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isLeaderOrOfficer && loadingRequests && joinRequests.length === 0 && (
        <p className="text-zinc-500 text-sm">参加申請を確認中...</p>
      )}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400">メンバー一覧 · 貢献度</h3>
        <ul className="space-y-2">
          {sorted.map((m, i) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-subtle bg-zinc-800/80 px-3 py-2">
              <span className="text-white text-sm">
                #{i + 1} {roleLabel(m.role)} <span className="text-zinc-300">{m.username ?? `ID: ${m.user_id.slice(0, 8)}…`}</span>
              </span>
              <span className="text-gold text-sm">
                寄付XP {m.donated_xp.toLocaleString()} · 今週 {m.questions_this_week}問
              </span>
              {isLeader && m.role === 'member' && officerCount < 3 && (
                <button
                  type="button"
                  onClick={() => handleOfficer(m.user_id, 'appoint')}
                  className="rounded border border-gold-subtle bg-[var(--gold)]/20 px-2 py-1 text-xs text-gold"
                >
                  幹部に任命
                </button>
              )}
              {isLeader && m.role === 'officer' && (
                <button
                  type="button"
                  onClick={() => handleOfficer(m.user_id, 'dismiss')}
                  className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400"
                >
                  幹部解任
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const GUILD_LAB_BRANCHES = [
  { id: 'stamina' as const, name: 'スタミナ上限', description: 'メンバー全員の最大スタミナを増やす', growth: 'Lv.1ごとに+5' },
  { id: 'xp' as const, name: 'XP倍率', description: '獲得XPが増加する', growth: 'Lv.1ごとに+1%' },
  { id: 'score' as const, name: '人数上限', description: 'ギルドの最大人数を増やす', growth: 'Lv.1ごとに+2人' },
];

/** ギルド研究室 Lv0→1 の必要XP（API と一致） */
const GUILD_LAB_COST_BASE: Record<'stamina' | 'xp' | 'score', number> = {
  xp: 150000,
  score: 250000,
  stamina: 350000,
};

function LabTab({ guild, membership, onEvolve, setMsg }: { guild: Guild; membership: Membership; onEvolve: () => void; setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void }) {
  const [loadingBranch, setLoadingBranch] = useState<string | null>(null);
  const canEvolve = membership.role === 'leader' || membership.role === 'officer';
  const totalXp = guild.total_donated_xp ?? 0;
  const labStamina = guild.lab_stamina_lv ?? 0;
  const labXp = guild.lab_xp_lv ?? 0;
  const labScore = guild.lab_score_lv ?? 0;

  const getLevel = (branch: 'stamina' | 'xp' | 'score') => branch === 'stamina' ? labStamina : branch === 'xp' ? labXp : labScore;
  const getCost = (branch: 'stamina' | 'xp' | 'score') => {
    const lv = getLevel(branch);
    if (lv >= 10) return Infinity;
    return GUILD_LAB_COST_BASE[branch] * Math.pow(2, lv);
  };

  const handleEvolve = async (branch: 'stamina' | 'xp' | 'score') => {
    if (!canEvolve || getLevel(branch) >= 10 || totalXp < getCost(branch)) return;
    setLoadingBranch(branch);
    setMsg(null);
    try {
      const res = await fetch('/api/guild/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ branch }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'ok', text: '研究室を強化しました' });
        onEvolve();
      } else {
        setMsg({ type: 'err', text: data?.error ?? '失敗しました' });
      }
    } catch {
      setMsg({ type: 'err', text: 'エラー' });
    } finally {
      setLoadingBranch(null);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">ギルド研究室</h3>
      <p className="text-zinc-300 text-sm">
        メンバーが通常プレイで獲得したXPの一部が自動でギルドXP・寄付XPに反映されます。リーダー・幹部が研究室を強化し、全員にバフが付与されます。
      </p>
      <p className="text-xs text-zinc-500">
        ギルドXP: <span className="font-bold text-amber-400">{totalXp.toLocaleString()}</span>
      </p>
      <div className="space-y-3">
        {GUILD_LAB_BRANCHES.map((item) => {
          const level = getLevel(item.id);
          const cost = getCost(item.id);
          const isMax = level >= 10;
          const canUp = canEvolve && !isMax && totalXp >= cost;
          return (
            <div key={item.id} className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{item.name} (Lv.{level})</p>
                  <p className="mt-1 text-zinc-400">{item.description}</p>
                  <p className="mt-1 text-zinc-500">
                    成長（Lv.1毎）: <span className="text-amber-400/90">{item.growth}</span>
                  </p>
                </div>
                <div className="shrink-0">
                  {isMax ? (
                    <span className="rounded border border-amber-500/50 bg-amber-900/30 px-2 py-1 text-xs font-bold text-amber-300">MAX</span>
                  ) : canEvolve ? (
                    <button
                      type="button"
                      disabled={!canUp || loadingBranch !== null}
                      onClick={() => handleEvolve(item.id)}
                      className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-black disabled:opacity-50"
                    >
                      {loadingBranch === item.id ? '…' : `${cost.toLocaleString()} XP`}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuildRankingTab({ myGuildId }: { myGuildId: string | null }) {
  const [ranking, setRanking] = useState<GuildRankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/guild/ranking', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { ranking: [] }))
      .then((data) => setRanking(Array.isArray(data.ranking) ? data.ranking : []))
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">ギルド実力ランキング</h3>
      <p className="text-zinc-500 text-xs">今週（月〜日）のメンバー各自のベスト（Part5＋単語）合計で順位が決まります。翌月曜にランキング報酬を付与します。</p>
      {loading ? (
        <LoadingWithPercent className="block text-sm text-zinc-500" />
      ) : ranking.length === 0 ? (
        <p className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-4 text-center text-sm text-zinc-500">まだギルドがありません</p>
      ) : (
        <ul className="space-y-2">
          {ranking.map((g, i) => {
            const isMyGuild = myGuildId != null && g.id === myGuildId;
            return (
              <li
                key={g.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isMyGuild ? 'border-[var(--gold)]/60 bg-[var(--gold)]/15' : 'border-gold-subtle bg-zinc-800/80'
                }`}
              >
                <span className="shrink-0 w-6 text-center font-bold text-gold">#{i + 1}</span>
                {g.emblem_url?.trim() ? (
                  <img src={g.emblem_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover bg-zinc-800" />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800 border border-gold-subtle/40 flex items-center justify-center text-sm font-bold text-zinc-500">{(g.name || 'G').charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{g.name}</p>
                  <p className="text-xs text-zinc-500">Lv.{g.level} · メンバー {g.memberCount}人</p>
                </div>
                <span className="shrink-0 text-gold font-medium">{g.weekly_score.toLocaleString()} pt</span>
                {isMyGuild && <span className="shrink-0 rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-xs text-gold">自分のギルド</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SearchTab({
  inGuild,
  onJoin,
  setMsg,
  userGuildXp,
}: {
  inGuild: boolean;
  onJoin: () => void;
  setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void;
  userGuildXp: number | null;
}) {
  const [tag, setTag] = useState<string>('');
  const [joinType, setJoinType] = useState<string>('');
  const [list, setList] = useState<Guild[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createComment, setCreateComment] = useState('');
  const [createJoinType, setCreateJoinType] = useState<'open' | 'approval' | 'invite'>('open');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [createTags, setCreateTags] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = async () => {
    setSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ search: '1' });
      if (tag) params.set('tag', tag);
      if (joinType) params.set('join_type', joinType);
      const res = await fetch(`/api/guild?${params}`, { credentials: 'include' });
      const data = await res.json();
      setList(data.guilds ?? []);
    } finally {
      setSearching(false);
    }
  };

  const handleJoin = async (guildId: string) => {
    const res = await fetch('/api/guild/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ guildId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: 'err', text: data?.error ?? '参加に失敗しました' });
      return;
    }
    setMsg({ type: 'ok', text: data?.message ?? '参加しました！' });
    onJoin();
  };

  const handleJoinByInviteCode = async () => {
    const code = inviteCodeInput.trim();
    if (!code) {
      setMsg({ type: 'err', text: '招待コードを入力してください' });
      return;
    }
    const res = await fetch('/api/guild/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ inviteCode: code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: 'err', text: data?.error ?? '参加に失敗しました' });
      return;
    }
    setMsg({ type: 'ok', text: data?.message ?? '参加しました！' });
    setInviteCodeInput('');
    onJoin();
  };

  const handleCreate = async () => {
    const name = createName.trim().slice(0, 20);
    if (!name) {
      setMsg({ type: 'err', text: 'ギルド名を入力してください（20文字以内）' });
      return;
    }
    if (userGuildXp !== null && userGuildXp < GUILD_CREATE_XP_COST) {
      setMsg({ type: 'err', text: `ギルドXPが足りません（${GUILD_CREATE_XP_COST.toLocaleString()} ギルドXP 必要）` });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/guild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          leaderComment: createComment.trim().slice(0, 100) || undefined,
          joinType: createJoinType,
          tags: createTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '作成に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: 'ギルドを作成しました！' });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gems-updated'));
      onJoin();
    } finally {
      setCreating(false);
    }
  };

  const toggleCreateTag = (t: string) => {
    setCreateTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 5)));
  };

  const canCreate = userGuildXp !== null && userGuildXp >= GUILD_CREATE_XP_COST;

  return (
    <div className="space-y-6">
      {!inGuild && (
        <div className="rounded-lg border border-gold-subtle bg-zinc-800/80 p-3 space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">招待コードで参加</h3>
          <p className="text-zinc-500 text-xs">招待制ギルドの招待コードを持っている場合はここで参加できます。</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="inv-xxxxxxxxxxxx"
              className="flex-1 min-w-0 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 font-mono"
            />
            <button
              type="button"
              onClick={handleJoinByInviteCode}
              className="shrink-0 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-2 text-sm text-gold"
            >
              参加
            </button>
          </div>
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-400">ギルド検索</h3>
      <div className="flex flex-wrap gap-2">
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
        >
          <option value="">タグなし</option>
          {GUILD_TAGS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <select
          value={joinType}
          onChange={(e) => setJoinType(e.target.value)}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
        >
          <option value="">すべて</option>
          <option value="open">誰でも入れる</option>
          <option value="approval">承認制</option>
          <option value="invite">招待制</option>
        </select>
        <button
          type="button"
          onClick={doSearch}
          disabled={searching}
          className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-2 text-sm font-medium text-gold disabled:opacity-50"
        >
          {searching ? '検索中...' : '検索'}
        </button>
      </div>
      <ul className="space-y-2">
        {list.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-subtle bg-zinc-800/80 p-3">
            {g.emblem_url?.trim() ? (
              <img src={g.emblem_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover bg-zinc-800" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800 border border-gold-subtle/40 flex items-center justify-center text-sm font-bold text-zinc-500">{(g.name || 'G').charAt(0)}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{g.name}</p>
              <p className="text-zinc-500 text-sm">
                Lv.{g.level} · {g.memberCount ?? 0}人 · {g.join_type === 'approval' ? '承認制' : g.join_type === 'invite' ? '招待制' : '誰でもOK'}
                {g.tags?.length ? ` · ${g.tags.join(', ')}` : ''}
              </p>
            </div>
            {!inGuild && g.join_type !== 'invite' && (
              <button
                type="button"
                onClick={() => handleJoin(g.id)}
                className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-1.5 text-sm font-medium text-gold hover:bg-[var(--gold)]/30"
              >
                参加
              </button>
            )}
            {!inGuild && g.join_type === 'invite' && (
              <span className="text-zinc-500 text-xs">招待コードで参加</span>
            )}
          </li>
        ))}
      </ul>
      {list.length === 0 && !searching && (
        <p className="text-zinc-500 text-sm">
          {hasSearched ? '該当するギルドがありません。条件を変えて検索してみてください。' : '検索ボタンでギルドを表示'}
        </p>
      )}

      {!inGuild && (
        <>
          <h3 className="text-sm font-medium text-zinc-400 mt-6">ギルドを新規作成</h3>
          <p className="text-sm text-zinc-500">
            リーダーとしてギルドを設立するには <span className="font-bold text-gold">{GUILD_CREATE_XP_COST.toLocaleString()} ギルドXP</span> 必要です。
            <span className="ml-1">
              所持: <span className="font-medium text-white">{userGuildXp !== null ? userGuildXp.toLocaleString() : '---'}</span> ギルドXP
            </span>
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400">ギルド名（20文字以内）</label>
              <input
                type="text"
                placeholder="ギルド名"
                maxLength={20}
                value={createName}
                onChange={(e) => setCreateName(e.target.value.slice(0, 20))}
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
              />
              <p className="mt-0.5 text-xs text-zinc-500">{createName.length}/20</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400">紹介文（任意・100文字以内）</label>
              <textarea
                placeholder="紹介文"
                maxLength={100}
                value={createComment}
                onChange={(e) => setCreateComment(e.target.value.slice(0, 100))}
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none"
                rows={2}
              />
              <p className="mt-0.5 text-xs text-zinc-500">{createComment.length}/100</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="radio" checked={createJoinType === 'open'} onChange={() => setCreateJoinType('open')} className="rounded" />
                誰でも入れる
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="radio" checked={createJoinType === 'approval'} onChange={() => setCreateJoinType('approval')} className="rounded" />
                承認制
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="radio" checked={createJoinType === 'invite'} onChange={() => setCreateJoinType('invite')} className="rounded" />
                招待制
              </label>
            </div>
            <div>
              <span className="block text-sm text-zinc-400 mb-1">タグ（任意）</span>
              <div className="flex flex-wrap gap-1">
                {GUILD_TAGS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleCreateTag(t.id)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                      createTags.includes(t.id) ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !canCreate}
              className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '作成中...' : `${GUILD_CREATE_XP_COST.toLocaleString()} ギルドXP でギルドを設立`}
            </button>
            {userGuildXp !== null && userGuildXp < GUILD_CREATE_XP_COST && (
              <p className="text-sm text-gold">ギルドXPが足りません。取引で全共通XPをギルドXPに交換するか、ギルドに参加して寄付で獲得できます。</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
