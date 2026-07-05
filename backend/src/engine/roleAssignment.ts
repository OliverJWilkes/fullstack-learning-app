import { Role, TEAM_BY_ROLE, getDistributionConfig } from "./roles.js";

export type HostType = "HUMAN" | "AI";

export interface RoleAssignment {
  playerId: string;
  role: Role;
  team: (typeof TEAM_BY_ROLE)[Role];
}

export class PoisonerDecisionRequiredError extends Error {
  constructor() {
    super("A Poisoner inclusion decision is required for this player count");
    this.name = "PoisonerDecisionRequiredError";
  }
}

export class InvalidRoleAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRoleAssignmentError";
  }
}

function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Decides whether the Poisoner is included for a player count where it's optional.
 * AI host: 50/50 coin flip. Human host: must pass an explicit decision.
 */
export function resolvePoisonerInclusion(
  playerCount: number,
  hostType: HostType,
  humanDecision: boolean | undefined,
  rng: () => number = Math.random,
): boolean {
  const { poisonerRule } = getDistributionConfig(playerCount);
  if (poisonerRule === "never") return false;
  if (poisonerRule === "mandatory") return true;

  // optional
  if (hostType === "AI") return rng() < 0.5;
  if (humanDecision === undefined) throw new PoisonerDecisionRequiredError();
  return humanDecision;
}

/** Builds the flat list of roles to hand out for a given player count + Poisoner decision. */
export function buildRoleList(playerCount: number, includePoisoner: boolean): Role[] {
  const config = getDistributionConfig(playerCount);

  const wolfRoles: Role[] = Array(config.wolves).fill(Role.WEREWOLF);
  if (includePoisoner) {
    wolfRoles[0] = Role.POISONER;
  }

  const villagerRoles: Role[] = Array(config.villagers).fill(Role.VILLAGER);

  return [...wolfRoles, ...config.specialRoles, ...villagerRoles];
}

/** Randomly assigns roles to players (used by "Randomize" and always by the AI host). */
export function assignRolesRandom(
  playerIds: string[],
  options: { hostType: HostType; poisonerDecision?: boolean },
  rng: () => number = Math.random,
): RoleAssignment[] {
  const includePoisoner = resolvePoisonerInclusion(playerIds.length, options.hostType, options.poisonerDecision, rng);
  const roles = shuffle(buildRoleList(playerIds.length, includePoisoner), rng);

  return playerIds.map((playerId, i) => {
    const role = roles[i];
    return { playerId, role, team: TEAM_BY_ROLE[role] };
  });
}

/** Validates a human host's hand-picked role assignment against the distribution table. */
export function validateHandPickedRoles(
  playerCount: number,
  assignments: Record<string, Role>,
): RoleAssignment[] {
  const playerIds = Object.keys(assignments);
  if (playerIds.length !== playerCount) {
    throw new InvalidRoleAssignmentError(
      `Expected roles for ${playerCount} players, got ${playerIds.length}`,
    );
  }

  const config = getDistributionConfig(playerCount);
  const counts = new Map<Role, number>();
  for (const role of Object.values(assignments)) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  const poisonerCount = counts.get(Role.POISONER) ?? 0;
  if (config.poisonerRule === "never" && poisonerCount > 0) {
    throw new InvalidRoleAssignmentError("The Poisoner is never included at this player count");
  }
  if (config.poisonerRule === "mandatory" && poisonerCount !== 1) {
    throw new InvalidRoleAssignmentError("The Poisoner is mandatory at this player count");
  }
  if (poisonerCount > 1) {
    throw new InvalidRoleAssignmentError("There can only be one Poisoner");
  }

  const werewolfCount = counts.get(Role.WEREWOLF) ?? 0;
  if (werewolfCount + poisonerCount !== config.wolves) {
    throw new InvalidRoleAssignmentError(
      `Expected ${config.wolves} werewolf-team players (including any Poisoner), got ${werewolfCount + poisonerCount}`,
    );
  }

  const expectedSpecialCounts = new Map<Role, number>();
  for (const role of config.specialRoles) {
    expectedSpecialCounts.set(role, (expectedSpecialCounts.get(role) ?? 0) + 1);
  }
  for (const [role, expectedCount] of expectedSpecialCounts) {
    const actualCount = counts.get(role) ?? 0;
    if (actualCount !== expectedCount) {
      throw new InvalidRoleAssignmentError(`Expected ${expectedCount} ${role}, got ${actualCount}`);
    }
  }

  const villagerCount = counts.get(Role.VILLAGER) ?? 0;
  if (villagerCount !== config.villagers) {
    throw new InvalidRoleAssignmentError(`Expected ${config.villagers} plain Villagers, got ${villagerCount}`);
  }

  return playerIds.map((playerId) => {
    const role = assignments[playerId];
    return { playerId, role, team: TEAM_BY_ROLE[role] };
  });
}
