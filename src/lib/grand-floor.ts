/**
 * THE GRAND FLOOR: 領土拡大・占領・城・サプライラインのロジック
 * - 地形: 山脈 15–20%、固定
 * - 拡大: 隣接マスのみ、Cost_n = 5000 * 2^(n-1)、1マス1日1回まで重ねがけ
 * - 占領: 敵マスは累計XPの2倍（城は3倍）。奪取時は城はLevel5のまま奪ったギルドの城に
 * - 城: Level5で建設。周囲1マスを自陣に自動付与
 * - サプライライン: 本拠地＋城をアンカーに、接続されていない領土は中立化
 */

export const GRAND_FLOOR = {
  INITIAL_SIZE: 100,
  EXPAND_BY: 50,
  OCCUPIED_THRESHOLD_RATIO: 0.8,
  /** 山は全体の 3〜5% に抑制（進入不可） */
  MOUNTAIN_RATIO_MIN: 0.03,
  MOUNTAIN_RATIO_MAX: 0.05,
  /** 15×15 の各区画に最低1つは資源マスを配置 */
  RESOURCE_REGION_SIZE: 15,
  HQ_BUFFER: 5,
  BASE_COST_XP: 5000,
  CONQUER_MULTIPLIER: 2,
  CASTLE_CONQUER_MULTIPLIER: 3,
  CASTLE_LEVEL: 5,
} as const;

export type ResourceType = 'chip_mine' | 'delphi' | 'hermes';

export interface Mountain {
  x: number;
  y: number;
}

export interface Resource {
  x: number;
  y: number;
  type: ResourceType;
}

export interface WorldTerrain {
  width: number;
  height: number;
  seed: number;
  mountains: Mountain[];
  resources: Resource[];
}

/** シードで再現可能な乱数 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/** 山脈をランダムに配置（全体の3–5%） */
export function generateMountains(
  width: number,
  height: number,
  seed: number
): Mountain[] {
  const total = width * height;
  const rng = seededRandom(seed);
  const ratio =
    GRAND_FLOOR.MOUNTAIN_RATIO_MIN +
    rng() * (GRAND_FLOOR.MOUNTAIN_RATIO_MAX - GRAND_FLOOR.MOUNTAIN_RATIO_MIN);
  const count = Math.floor(total * ratio);
  const set = new Set<string>();
  while (set.size < count) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    set.add(`${x},${y}`);
  }
  return Array.from(set).map((s) => {
    const [x, y] = s.split(',').map(Number);
    return { x, y };
  });
}

/** 15×15 の各区画に最低1つは資源マスを配置。山でないマスから1セルを選び、種類は chip_mine / delphi / hermes をローテーション */
export function generateResources(
  width: number,
  height: number,
  mountains: Mountain[],
  seed: number
): Resource[] {
  const mountainSet = new Set(mountains.map((m) => `${m.x},${m.y}`));
  const size = GRAND_FLOOR.RESOURCE_REGION_SIZE;
  const regionsX = Math.ceil(width / size);
  const regionsY = Math.ceil(height / size);
  const rng = seededRandom(seed + 1);
  const types: Resource['type'][] = ['chip_mine', 'delphi', 'hermes'];
  const resources: Resource[] = [];
  const used = new Set<string>();

  for (let ri = 0; ri < regionsX; ri++) {
    for (let rj = 0; rj < regionsY; rj++) {
      const minX = ri * size;
      const minY = rj * size;
      const maxX = Math.min(width, minX + size);
      const maxY = Math.min(height, minY + size);
      const candidates: { x: number; y: number }[] = [];
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          if (!mountainSet.has(`${x},${y}`)) candidates.push({ x, y });
        }
      }
      if (candidates.length === 0) continue;
      const idx = Math.floor(rng() * candidates.length);
      const cell = candidates[idx];
      const key = `${cell.x},${cell.y}`;
      if (used.has(key)) continue;
      used.add(key);
      const type = types[(ri * regionsY + rj) % types.length];
      resources.push({ ...cell, type });
    }
  }
  return resources;
}

/** 拡大コスト: Cost_n = 5000 * 2^(n-1) */
export function expansionCostXp(level: number): number {
  return GRAND_FLOOR.BASE_COST_XP * Math.pow(2, level - 1);
}

/** 占領に必要なXP（通常2倍、城3倍） */
export function conquerCostXp(totalXp: number, isCastle: boolean): number {
  const mult = isCastle
    ? GRAND_FLOOR.CASTLE_CONQUER_MULTIPLIER
    : GRAND_FLOOR.CONQUER_MULTIPLIER;
  return totalXp * mult;
}

/** 上下左右の隣接座標 */
export function orthogonalNeighbors(x: number, y: number): { x: number; y: number }[] {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ];
}

const byKey = (x: number, y: number) => `${x},${y}`;

/**
 * 1ギルドについて、アンカー（本拠地＋城）から orthogonally に繋がっている領地のみ有効とする。
 * 戻り値: 有効なセルの key 集合。この集合に含まれない自ギルドセルは中立化する。
 */
export function computeConnectedTerritoryForGuild(
  guildCellKeys: Set<string>,
  anchorKeys: Set<string>,
  width: number,
  height: number
): Set<string> {
  const inBounds = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height;
  const visited = new Set<string>();
  const queue = Array.from(anchorKeys).filter((k) => guildCellKeys.has(k));
  queue.forEach((k) => visited.add(k));
  while (queue.length > 0) {
    const key = queue.shift()!;
    const [px, py] = key.split(',').map(Number);
    orthogonalNeighbors(px, py).forEach(({ x, y }) => {
      const k = byKey(x, y);
      if (!inBounds(x, y) || visited.has(k) || !guildCellKeys.has(k)) return;
      visited.add(k);
      queue.push(k);
    });
  }
  return visited;
}

/** 城が建ったとき／城を奪ったとき、周囲1マスを自陣に付与（上書き） */
export function castleNeighborCells(cx: number, cy: number): { x: number; y: number }[] {
  return orthogonalNeighbors(cx, cy);
}

/** ギルドのアンカー（本拠地＋城）の key 集合を返す */
export function getGuildAnchorKeys(
  hq: { x: number; y: number } | null,
  cells: { x: number; y: number; guild_id: string | null; level: number }[],
  guildId: string
): Set<string> {
  const keys = new Set<string>();
  if (hq) keys.add(byKey(hq.x, hq.y));
  cells.forEach((c) => {
    if (c.guild_id === guildId && c.level === GRAND_FLOOR.CASTLE_LEVEL)
      keys.add(byKey(c.x, c.y));
  });
  return keys;
}
