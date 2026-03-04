'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { GACHA_EQUIPMENT } from '@/lib/equipment-items';
import type { TournamentRules } from '@/lib/tournament';

function getHeaders(secret: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-secret': secret.trim(),
  };
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [secretConfirmed, setSecretConfirmed] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [part5Text, setPart5Text] = useState('');
  const [vocabText, setVocabText] = useState('');
  const [bulletinTitle, setBulletinTitle] = useState('');
  const [bulletinBody, setBulletinBody] = useState('');
  const [tournamentPrizeLabel, setTournamentPrizeLabel] = useState('');
  const [tournamentPrizeYen, setTournamentPrizeYen] = useState<number | ''>('');
  const [tournamentRulesEnabled, setTournamentRulesEnabled] = useState(false);
  const [tournamentRules, setTournamentRules] = useState<TournamentRules | null>(null);
  const [tournamentLoaded, setTournamentLoaded] = useState(false);

  useEffect(() => {
    if (!secretConfirmed || !secret.trim()) return;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/tournament', { headers: getHeaders(secret.trim()) });
        if (!res.ok) return;
        const data = await res.json();
        setTournamentPrizeLabel(data.prizeLabel ?? '');
        setTournamentPrizeYen(data.prizeYen ?? '');
        setTournamentRulesEnabled(data.rulesEnabled ?? false);
        setTournamentRules(data.rules ?? null);
      } finally {
        setTournamentLoaded(true);
      }
    };
    load();
  }, [secretConfirmed, secret]);

  const setEquipmentAllowed = useCallback((id: string, allowed: boolean) => {
    setTournamentRules((r) =>
      r
        ? {
            ...r,
            equipment: { ...r.equipment, [id]: { ...r.equipment[id], allowed } },
          }
        : null
    );
  }, []);
  const setEquipmentLevel = useCallback((id: string, level: number) => {
    setTournamentRules((r) =>
      r
        ? {
            ...r,
            equipment: { ...r.equipment, [id]: { ...r.equipment[id], level } },
          }
        : null
    );
  }, []);

  const handleSaveTournament = useCallback(async () => {
    if (!secret.trim()) return;
    if (!tournamentRules) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PUT',
        headers: getHeaders(secret.trim()),
        body: JSON.stringify({
          prizeLabel: tournamentPrizeLabel,
          prizeYen: tournamentPrizeYen === '' ? null : Number(tournamentPrizeYen),
          rulesEnabled: tournamentRulesEnabled,
          rules: tournamentRules,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: 'ok', text: '大会設定を保存しました' });
      } else {
        setMsg({ type: 'err', text: j.error ?? '保存に失敗しました' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret, tournamentPrizeLabel, tournamentPrizeYen, tournamentRulesEnabled, tournamentRules]);

  const tryConfirmSecret = useCallback(async () => {
    if (!secret.trim()) {
      setMsg({ type: 'err', text: 'パスワードを入力してください' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/export-vocab-csv', {
        headers: getHeaders(secret.trim()),
      });
      if (res.ok) {
        setSecretConfirmed(true);
        setMsg({ type: 'ok', text: '認証しました' });
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: 'err', text: j.error ?? '認証に失敗しました' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const handleExportVocab = useCallback(async () => {
    if (!secret.trim()) {
      setMsg({ type: 'err', text: '先にパスワードを入力して認証してください' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/export-vocab-csv', {
        headers: getHeaders(secret.trim()),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vocabulary.csv';
        a.click();
        URL.revokeObjectURL(url);
        setMsg({ type: 'ok', text: 'CSVをダウンロードしました' });
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: 'err', text: j.error ?? 'エラー' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const handleExportPart5 = useCallback(async () => {
    if (!secret.trim()) {
      setMsg({ type: 'err', text: '先にパスワードを入力して認証してください' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/export-part5-csv', {
        headers: getHeaders(secret.trim()),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'part5-questions.csv';
        a.click();
        URL.revokeObjectURL(url);
        setMsg({ type: 'ok', text: 'CSVをダウンロードしました' });
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ type: 'err', text: j.error ?? 'エラー' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const handleAddPart5 = useCallback(async () => {
    if (!secret.trim()) {
      setMsg({ type: 'err', text: '先にパスワードを入力して認証してください' });
      return;
    }
    if (!part5Text.trim()) {
      setMsg({ type: 'err', text: 'Part 5 問題を入力してください' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/add-part5', {
        method: 'POST',
        headers: getHeaders(secret.trim()),
        body: JSON.stringify({ text: part5Text.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: 'ok', text: j.message ?? `${j.count} 問を追加しました` });
        setPart5Text('');
      } else {
        setMsg({ type: 'err', text: j.error ?? '追加に失敗しました' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret, part5Text]);

  const handlePostBulletin = useCallback(async () => {
    if (!secret.trim()) {
      setMsg({ type: 'err', text: '先にパスワードを入力して認証してください' });
      return;
    }
    if (!bulletinTitle.trim()) {
      setMsg({ type: 'err', text: 'タイトルを入力してください' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: getHeaders(secret.trim()),
        body: JSON.stringify({ title: bulletinTitle.trim(), body: bulletinBody.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: 'ok', text: '掲示板に投稿しました。全ユーザーが閲覧できます。' });
        setBulletinTitle('');
        setBulletinBody('');
      } else {
        setMsg({ type: 'err', text: j.error ?? '投稿に失敗しました' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret, bulletinTitle, bulletinBody]);

  const handleAddVocab = useCallback(async () => {
    if (!secret.trim()) {
      setMsg({ type: 'err', text: '先にパスワードを入力して認証してください' });
      return;
    }
    if (!vocabText.trim()) {
      setMsg({ type: 'err', text: '単語を入力してください' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/add-vocab', {
        method: 'POST',
        headers: getHeaders(secret.trim()),
        body: JSON.stringify({ text: vocabText.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: 'ok', text: j.message ?? `${j.count} 単語を追加しました` });
        setVocabText('');
      } else {
        setMsg({ type: 'err', text: j.error ?? '追加に失敗しました' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setLoading(false);
    }
  }, [secret, vocabText]);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 underline hover:text-white"
        >
          ← ホームに戻る
        </Link>
        <h1 className="text-2xl font-bold">管理者画面</h1>
        <p className="mt-1 text-sm text-zinc-500">
          大会設定・掲示板・全国単語・Part 5 のCSV出力と追加ができます。追加したデータは全国モードで出題されます。
        </p>

        {msg && (
          <div
            className={`mt-4 rounded-lg px-4 py-2 text-sm ${
              msg.type === 'ok' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* 認証: ADMIN_SECRET（環境変数）と一致する値を入力 */}
        <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <h2 className="font-semibold">認証（ADMIN_SECRET）</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Vercel 等で設定した環境変数 ADMIN_SECRET の値を入力してください。
          </p>
          <div className="mt-3 flex gap-3">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="ADMIN_SECRET の値"
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={tryConfirmSecret}
              disabled={loading}
              className="rounded-lg bg-zinc-600 px-4 py-2 font-medium hover:bg-zinc-500 disabled:opacity-50"
            >
              認証
            </button>
          </div>
          {secretConfirmed && (
            <p className="mt-2 text-xs text-emerald-400">認証済み</p>
          )}
        </section>

        {/* 掲示板（運営からのお知らせ） */}
        <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <h2 className="font-semibold">掲示板に投稿</h2>
          <p className="mt-1 text-sm text-zinc-500">
            ここで投稿した内容は、ホーム・ランキングページの「掲示板」で全ユーザーが読めます。
          </p>
          <input
            type="text"
            value={bulletinTitle}
            onChange={(e) => setBulletinTitle(e.target.value)}
            placeholder="タイトル"
            className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <textarea
            value={bulletinBody}
            onChange={(e) => setBulletinBody(e.target.value)}
            placeholder="本文（任意）"
            rows={4}
            className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handlePostBulletin}
            disabled={loading || !bulletinTitle.trim()}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            掲示板に投稿
          </button>
        </section>

        {/* 大会設定（今週の賞品・ルール） */}
        {secretConfirmed && (
          <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
            <h2 className="font-semibold">大会設定（今週）</h2>
            <p className="mt-1 text-sm text-zinc-500">
              日曜 12:00〜23:00 の大会の賞品とルール。ルールOFF＝全員が自分の装備・成長をフル使用。ルールON＝下記の装備・レベル・成長のみ適用。
            </p>
            {tournamentLoaded && tournamentRules && (
              <>
                <div className="mt-4 space-y-2">
                  <label className="block text-sm text-zinc-400">賞品説明</label>
                  <input
                    type="text"
                    value={tournamentPrizeLabel}
                    onChange={(e) => setTournamentPrizeLabel(e.target.value)}
                    placeholder="例: アマゾンギフト券 3000円分"
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                  <label className="block text-sm text-zinc-400">賞品金額（円・任意）</label>
                  <input
                    type="number"
                    value={tournamentPrizeYen}
                    onChange={(e) => setTournamentPrizeYen(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="3000"
                    min={0}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tournamentRulesEnabled}
                    onClick={() => setTournamentRulesEnabled((b) => !b)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none ${
                      tournamentRulesEnabled ? 'border-amber-500 bg-amber-600' : 'border-zinc-600 bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                        tournamentRulesEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-zinc-300">ルール設定をON（装備・成長を制限）</span>
                </div>
                {tournamentRulesEnabled && (
                  <div className="mt-4 space-y-4 rounded-lg border border-zinc-600 bg-zinc-800/80 p-4">
                    <p className="text-xs text-zinc-500">使用可能にする装備にチェックを入れ、レベル（0〜10）を設定。OFFのときは全員フル使用のためこのブロックは非表示。</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="w-8">使用</span>
                        <span className="flex-1">装備名</span>
                        <span className="w-16 text-right">Lv</span>
                      </div>
                      {GACHA_EQUIPMENT.map((eq) => (
                        <div key={eq.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={tournamentRules.equipment[eq.id]?.allowed ?? true}
                            onChange={(e) => setEquipmentAllowed(eq.id, e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="flex-1 text-sm text-white">{eq.name}</span>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            value={tournamentRules.equipment[eq.id]?.level ?? 5}
                            onChange={(e) => setEquipmentLevel(eq.id, parseInt(e.target.value, 10))}
                            className="h-2 w-20 accent-amber-500"
                          />
                          <span className="w-6 text-right text-xs text-zinc-500">{tournamentRules.equipment[eq.id]?.level ?? 5}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 border-t border-zinc-600 pt-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tournamentRules.personalGrowth}
                          onChange={(e) => setTournamentRules((r) => (r ? { ...r, personalGrowth: e.target.checked } : null))}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-300">個人の成長（進化等）を有効</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tournamentRules.guildGrowth}
                          onChange={(e) => setTournamentRules((r) => (r ? { ...r, guildGrowth: e.target.checked } : null))}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-300">ギルドの成長を有効</span>
                      </label>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSaveTournament}
                  disabled={loading}
                  className="mt-4 rounded-lg bg-amber-600 px-4 py-2 font-medium hover:bg-amber-500 disabled:opacity-50"
                >
                  決定（保存）
                </button>
              </>
            )}
            {tournamentLoaded && !tournamentRules && (
              <p className="mt-2 text-sm text-zinc-500">読み込み中…</p>
            )}
          </section>
        )}

        {/* CSV出力 */}
        <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <h2 className="font-semibold">CSV出力</h2>
          <p className="mt-1 text-sm text-zinc-500">
            登録済みの全国単語・Part 5 問題をCSVでダウンロード
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportVocab}
              disabled={loading}
              className="rounded-lg bg-amber-600 px-4 py-2 font-medium hover:bg-amber-500 disabled:opacity-50"
            >
              全国単語をCSV出力
            </button>
            <button
              type="button"
              onClick={handleExportPart5}
              disabled={loading}
              className="rounded-lg bg-amber-600 px-4 py-2 font-medium hover:bg-amber-500 disabled:opacity-50"
            >
              Part 5 をCSV出力
            </button>
          </div>
        </section>

        {/* Part 5 追加 */}
        <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <h2 className="font-semibold">Part 5 問題を追加</h2>
          <p className="mt-1 text-sm text-zinc-500">
            以下の形式で1問ずつ入力。複数問は空行で区切ってください。
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-800 p-3 text-xs text-zinc-300">
{`We need to ( ) the risks associated with the new investment.
(A) instigate
(B) duplicate
(C) mitigate
(D) navigate
正解: (C)
解説: mitigate(軽減する)は、リスクや被害を和らげるという文脈で非常によく出ます。`}
          </pre>
          <textarea
            value={part5Text}
            onChange={(e) => setPart5Text(e.target.value)}
            placeholder="上記形式で問題を貼り付けてください…"
            rows={10}
            className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddPart5}
            disabled={loading || !part5Text.trim()}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            Part 5 を追加
          </button>
        </section>

        {/* 全国単語を追加 */}
        <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <h2 className="font-semibold">全国単語を追加</h2>
          <p className="mt-1 text-sm text-zinc-500">
            1行1単語で「単語：意味1、意味2」の形式。追加した単語は全国モードで出題されます。
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-800 p-3 text-xs text-zinc-300">
{`Delegate：委譲する、代表者
Assign：割り当てる、配属する
Allocate：配分する、割り当てる
Designate：指定する、指名する`}
          </pre>
          <textarea
            value={vocabText}
            onChange={(e) => setVocabText(e.target.value)}
            placeholder="上記形式で単語を貼り付けてください…"
            rows={8}
            className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddVocab}
            disabled={loading || !vocabText.trim()}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            全国単語を追加
          </button>
        </section>

        <p className="mt-8 text-center text-xs text-zinc-600">
          単語 For You の CSV 出力・追加は学習履歴から行えます。
        </p>
      </div>
    </div>
  );
}
