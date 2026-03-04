import { GACHA_EQUIPMENT } from '@/lib/equipment-items';

/** 今週の日曜（JST）の日付文字列 YYYY-MM-DD。大会の週識別に使用。 */
export function getCurrentWeekSunday(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jst = new Date(now.getTime() + (jstOffset - now.getTimezoneOffset()) * 60 * 1000);
  const day = jst.getDay();
  const sundayOffset = day === 0 ? 0 : day;
  const sunday = new Date(jst);
  sunday.setDate(jst.getDate() - sundayOffset);
  return sunday.toISOString().slice(0, 10);
}

/** 日曜 12:00 JST 〜 23:00 JST のうちかどうか */
export function isTournamentWindowNow(): boolean {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jst = new Date(now.getTime() + (jstOffset - now.getTimezoneOffset()) * 60 * 1000);
  const day = jst.getDay();
  if (day !== 0) return false;
  const hours = jst.getHours();
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
