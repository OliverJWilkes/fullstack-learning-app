import type { RoleName } from './roles.ts';

export type VampireRule = 'NEVER' | 'OPTIONAL' | 'MANDATORY';

export type HostType = 'HUMAN' | 'AI';

interface RoleComposition {
  wolfCount: number;
  vampireRule: VampireRule;
  specialVillageRoles: RoleName[];
  plainVillagerCount: number;
}

// Spec section 2.2 (werewolf count) + 2.3 (role distribution table).
const ROLE_TABLE: Record<number, RoleComposition> = {
  8: { wolfCount: 2, vampireRule: 'NEVER', specialVillageRoles: ['SEER', 'DOCTOR'], plainVillagerCount: 4 },
  9: { wolfCount: 2, vampireRule: 'NEVER', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE'], plainVillagerCount: 4 },
  10: { wolfCount: 2, vampireRule: 'NEVER', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR'], plainVillagerCount: 4 },
  11: { wolfCount: 3, vampireRule: 'OPTIONAL', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR'], plainVillagerCount: 4 },
  12: { wolfCount: 3, vampireRule: 'OPTIONAL', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER'], plainVillagerCount: 4 },
  13: { wolfCount: 3, vampireRule: 'OPTIONAL', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER', 'TANNER'], plainVillagerCount: 4 },
  14: { wolfCount: 4, vampireRule: 'OPTIONAL', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER', 'TANNER'], plainVillagerCount: 4 },
  15: { wolfCount: 4, vampireRule: 'OPTIONAL', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER', 'TANNER', 'MASON', 'MASON'], plainVillagerCount: 3 },
  16: { wolfCount: 5, vampireRule: 'MANDATORY', specialVillageRoles: ['SEER', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER', 'TANNER', 'MASON', 'MASON'], plainVillagerCount: 3 },
  17: { wolfCount: 5, vampireRule: 'MANDATORY', specialVillageRoles: ['SEER', 'DOCTOR', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER', 'TANNER', 'MASON', 'MASON'], plainVillagerCount: 3 },
  18: { wolfCount: 5, vampireRule: 'MANDATORY', specialVillageRoles: ['SEER', 'DOCTOR', 'DOCTOR', 'DETECTIVE', 'MAYOR', 'HUNTER', 'TANNER', 'MASON', 'MASON'], plainVillagerCount: 4 },
};

export const MIN_PLAYERS = 8;
export const MAX_PLAYERS = 18;

function requireValidPlayerCount(playerCount: number): RoleComposition {
  const composition = ROLE_TABLE[playerCount];
  if (!composition) {
    throw new Error(`Unsupported player count: ${playerCount}. Must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`);
  }
  return composition;
}

export function getWerewolfCount(playerCount: number): number {
  return requireValidPlayerCount(playerCount).wolfCount;
}

export function getVampireRule(playerCount: number): VampireRule {
  return requireValidPlayerCount(playerCount).vampireRule;
}

/**
 * Resolves whether the Vampire is part of this game, per spec section 2.3's
 * inclusion rule: never at 2 wolves, mandatory at 5, host's choice at 3-4
 * (human host decides explicitly, AI host decides randomly).
 */
export function resolveVampireInclusion(
  playerCount: number,
  hostType: HostType,
  options: { humanChoice?: boolean; rng?: () => number } = {},
): boolean {
  const rule = getVampireRule(playerCount);
  if (rule === 'NEVER') return false;
  if (rule === 'MANDATORY') return true;

  if (hostType === 'HUMAN') {
    return options.humanChoice ?? false;
  }
  const rng = options.rng ?? Math.random;
  return rng() < 0.5;
}

/**
 * Builds the flat list of roles to deal out for a game (length === playerCount).
 */
export function buildRolePool(playerCount: number, includeVampire: boolean): RoleName[] {
  const composition = requireValidPlayerCount(playerCount);
  const plainWolfCount = composition.wolfCount - (includeVampire ? 1 : 0);

  const pool: RoleName[] = [
    ...composition.specialVillageRoles,
    ...Array<RoleName>(composition.plainVillagerCount).fill('VILLAGER'),
    ...Array<RoleName>(plainWolfCount).fill('WEREWOLF'),
  ];
  if (includeVampire) pool.push('VAMPIRE');
  return pool;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Randomly deals the role pool out to players (AI host always uses this path;
 * human host may use it too via "Randomize").
 */
export function assignRolesRandomly(
  playerIds: string[],
  rolePool: RoleName[],
  rng: () => number = Math.random,
): Map<string, RoleName> {
  if (playerIds.length !== rolePool.length) {
    throw new Error(
      `Player count (${playerIds.length}) does not match role pool size (${rolePool.length}).`,
    );
  }
  const shuffled = shuffle(rolePool, rng);
  return new Map(playerIds.map((id, i) => [id, shuffled[i]!]));
}

/**
 * Validates a human host's hand-picked role assignment against the required
 * pool for this player count (same role, same multiplicity, nothing missing
 * or extra).
 */
export function validateHandPickedAssignment(
  assignment: Map<string, RoleName>,
  rolePool: RoleName[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (assignment.size !== rolePool.length) {
    errors.push(`Expected ${rolePool.length} assigned players, got ${assignment.size}.`);
  }

  const expectedCounts = new Map<RoleName, number>();
  for (const role of rolePool) {
    expectedCounts.set(role, (expectedCounts.get(role) ?? 0) + 1);
  }

  const actualCounts = new Map<RoleName, number>();
  for (const role of assignment.values()) {
    actualCounts.set(role, (actualCounts.get(role) ?? 0) + 1);
  }

  for (const [role, expected] of expectedCounts) {
    const actual = actualCounts.get(role) ?? 0;
    if (actual !== expected) {
      errors.push(`Expected ${expected}x ${role}, got ${actual}.`);
    }
  }
  for (const role of actualCounts.keys()) {
    if (!expectedCounts.has(role)) {
      errors.push(`Unexpected role in assignment: ${role}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
