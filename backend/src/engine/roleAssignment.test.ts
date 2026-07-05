import { describe, it, expect } from "vitest";
import { Role, DISTRIBUTION_TABLE, MIN_PLAYERS, MAX_PLAYERS, getDistributionConfig } from "./roles.js";
import {
  assignRolesRandom,
  buildRoleList,
  resolvePoisonerInclusion,
  validateHandPickedRoles,
  PoisonerDecisionRequiredError,
  InvalidRoleAssignmentError,
} from "./roleAssignment.js";

function countRoles(roles: Role[]): Map<Role, number> {
  const counts = new Map<Role, number>();
  for (const role of roles) counts.set(role, (counts.get(role) ?? 0) + 1);
  return counts;
}

describe("role distribution table", () => {
  for (let playerCount = MIN_PLAYERS; playerCount <= MAX_PLAYERS; playerCount++) {
    it(`sums to exactly ${playerCount} players`, () => {
      const config = getDistributionConfig(playerCount);
      const total = config.wolves + config.specialRoles.length + config.villagers;
      expect(total).toBe(playerCount);
    });
  }

  it("requires a minimum of 3 plain villagers at every player count", () => {
    for (const config of Object.values(DISTRIBUTION_TABLE)) {
      expect(config.villagers).toBeGreaterThanOrEqual(3);
    }
  });

  it("applies the correct Poisoner rule by wolf count", () => {
    expect(DISTRIBUTION_TABLE[8].poisonerRule).toBe("never");
    expect(DISTRIBUTION_TABLE[9].poisonerRule).toBe("never");
    expect(DISTRIBUTION_TABLE[10].poisonerRule).toBe("never");
    for (const count of [11, 12, 13, 14, 15]) {
      expect(DISTRIBUTION_TABLE[count].poisonerRule).toBe("optional");
    }
    for (const count of [16, 17, 18]) {
      expect(DISTRIBUTION_TABLE[count].poisonerRule).toBe("mandatory");
    }
  });
});

describe("resolvePoisonerInclusion", () => {
  it("never includes the Poisoner at 8-10 players regardless of host/rng", () => {
    expect(resolvePoisonerInclusion(8, "AI", undefined, () => 0)).toBe(false);
    expect(resolvePoisonerInclusion(9, "HUMAN", true, () => 0)).toBe(false);
  });

  it("always includes the Poisoner at 16-18 players regardless of host/rng", () => {
    expect(resolvePoisonerInclusion(16, "AI", undefined, () => 0.99)).toBe(true);
    expect(resolvePoisonerInclusion(17, "HUMAN", false, () => 0.99)).toBe(true);
  });

  it("flips a coin for the AI host at optional player counts", () => {
    expect(resolvePoisonerInclusion(12, "AI", undefined, () => 0.1)).toBe(true);
    expect(resolvePoisonerInclusion(12, "AI", undefined, () => 0.9)).toBe(false);
  });

  it("requires an explicit human decision at optional player counts", () => {
    expect(() => resolvePoisonerInclusion(12, "HUMAN", undefined)).toThrow(PoisonerDecisionRequiredError);
    expect(resolvePoisonerInclusion(12, "HUMAN", true)).toBe(true);
    expect(resolvePoisonerInclusion(12, "HUMAN", false)).toBe(false);
  });
});

describe("buildRoleList", () => {
  it("swaps one werewolf slot for the Poisoner when included", () => {
    const withoutPoisoner = countRoles(buildRoleList(12, false));
    expect(withoutPoisoner.get(Role.WEREWOLF)).toBe(3);
    expect(withoutPoisoner.get(Role.POISONER) ?? 0).toBe(0);

    const withPoisoner = countRoles(buildRoleList(12, true));
    expect(withPoisoner.get(Role.WEREWOLF)).toBe(2);
    expect(withPoisoner.get(Role.POISONER)).toBe(1);
  });
});

describe("assignRolesRandom", () => {
  for (let playerCount = MIN_PLAYERS; playerCount <= MAX_PLAYERS; playerCount++) {
    it(`assigns exactly one role per player for ${playerCount} players (AI host)`, () => {
      const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i}`);
      const assignments = assignRolesRandom(playerIds, { hostType: "AI" });

      expect(assignments).toHaveLength(playerCount);
      expect(new Set(assignments.map((a) => a.playerId)).size).toBe(playerCount);

      const roleCounts = countRoles(assignments.map((a) => a.role));
      const config = getDistributionConfig(playerCount);
      const poisonerCount = roleCounts.get(Role.POISONER) ?? 0;
      const werewolfCount = roleCounts.get(Role.WEREWOLF) ?? 0;
      expect(werewolfCount + poisonerCount).toBe(config.wolves);
      expect(roleCounts.get(Role.VILLAGER)).toBe(config.villagers);
    });
  }

  it("throws for a human host at an optional player count with no Poisoner decision", () => {
    const playerIds = Array.from({ length: 12 }, (_, i) => `p${i}`);
    expect(() => assignRolesRandom(playerIds, { hostType: "HUMAN" })).toThrow(PoisonerDecisionRequiredError);
  });
});

describe("validateHandPickedRoles", () => {
  it("accepts a valid 8-player assignment", () => {
    const assignments = {
      p0: Role.WEREWOLF,
      p1: Role.WEREWOLF,
      p2: Role.SEER,
      p3: Role.DOCTOR,
      p4: Role.VILLAGER,
      p5: Role.VILLAGER,
      p6: Role.VILLAGER,
      p7: Role.VILLAGER,
    };
    const result = validateHandPickedRoles(8, assignments);
    expect(result).toHaveLength(8);
  });

  it("rejects a Poisoner at a player count where it's never allowed", () => {
    const assignments = {
      p0: Role.POISONER,
      p1: Role.WEREWOLF,
      p2: Role.SEER,
      p3: Role.DOCTOR,
      p4: Role.VILLAGER,
      p5: Role.VILLAGER,
      p6: Role.VILLAGER,
      p7: Role.VILLAGER,
    };
    expect(() => validateHandPickedRoles(8, assignments)).toThrow(InvalidRoleAssignmentError);
  });

  it("rejects a mandatory-Poisoner player count with no Poisoner", () => {
    const playerIds = Array.from({ length: 16 }, (_, i) => `p${i}`);
    const config = getDistributionConfig(16);
    const roles = [...Array(config.wolves).fill(Role.WEREWOLF), ...config.specialRoles, ...Array(config.villagers).fill(Role.VILLAGER)];
    const assignments: Record<string, Role> = {};
    playerIds.forEach((id, i) => (assignments[id] = roles[i]));

    expect(() => validateHandPickedRoles(16, assignments)).toThrow(InvalidRoleAssignmentError);
  });

  it("rejects a mismatched player count", () => {
    expect(() => validateHandPickedRoles(8, { p0: Role.WEREWOLF })).toThrow(InvalidRoleAssignmentError);
  });
});
