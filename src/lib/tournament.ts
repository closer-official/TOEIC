import { GACHA_EQUIPMENT } from '@/lib/equipment-items';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 現在時刻を JST として解釈したときの (曜日 0-6, 時 0-23) を返す。端末のタイムゾーンに依存しない。 */
function getJstDayAndHour(now: Date): { day: number; hours: number } {
  const t = new Date(now.getTime() + JST_OFFSET_MS);
  return { day: t.getUTCDay(), hours: t.getUTCHours() };
}

/** 今週の日曜（JST）の日付文字列 YYYY-MM-DD。大会の週識別に使用。端末タイムゾーンに依存しない。 */
export function getCurrentWeekSunday(): string {
  const now = new Date();
  const t = new Date(now.getTime() + JST_OFFSET_MS);
  const day = t.getUTCDay();
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const d = t.getUTCDate();
  const sunday = new Date(Date.UTC(y, m, d - day, 0, 0, 0, 0));
  return sunday.toISOString().slice(0, 10);
}

/** 日曜 12:00 JST 〜 23:00 JST のうちかどうか。端末のタイムゾーンに依存せず JST で判定。 */
export function isTournamentWindowNow(): boolean {
  const { day, hours } = getJstDayAndHour(new Date());
  if (day !== 0) return false;
  return hours >= 12 && hours < 23;
}

export type TournamentRulesEquipment = { allowed: boolean; level: number };

export type TournamentRules = {
  rulesEnabled: boolean;
  equipment: Record<string, TournamentRulesEquipment>;
  personalGrowth: boolean;
  guildGrowth: boolean;
};

const EQUIPMENT_IDS = GACHA_EQUIPMENT.map((e) => e.id);

/** デフォルトの大会ルール（ルールOFF = 全員フル使用） */
export function getDefaultTournamentRules(): TournamentRules {
  const equipment: Record<string, TournamentRulesEquipment> = {};
  for (const id of EQUIPMENT_IDS) {
    equipment[id] = { allowed: true, level: 5 };
  }
  return {
    rulesEnabled: false,
    equipment,
    personalGrowth: true,
    guildGrowth: true,
  };
}

/** DB の rules JSON をパース。欠けている装備IDは allowed: true, level: 5 で補う。 */
export function parseTournamentRules(
  rulesEnabled: boolean,
  rulesJson: Record<string, unknown> | null
): TournamentRules {
  const equipment: Record<string, TournamentRulesEquipment> = {};
  const rawEq = rulesJson?.equipment as Record<string, { allowed?: boolean; level?: number }> | undefined;
  for (const id of EQUIPMENT_IDS) {
    const r = rawEq?.[id];
    equipment[id] = {
      allowed: r?.allowed ?? true,
      level: typeof r?.level === 'number' ? Math.max(0, Math.min(10, r.level)) : 5,
    };
  }
  return {
    rulesEnabled: rulesEnabled ?? false,
    equipment,
    personalGrowth: (rulesJson?.personalGrowth as boolean) ?? true,
    guildGrowth: (rulesJson?.guildGrowth as boolean) ?? true,
  };
}

export { EQUIPMENT_IDS };
