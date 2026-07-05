import { Role, Team } from "@prisma/client";

export { Role, Team };

export const TEAM_BY_ROLE: Record<Role, Team> = {
  VILLAGER: Team.VILLAGE,
  WEREWOLF: Team.WEREWOLF,
  SEER: Team.VILLAGE,
  DOCTOR: Team.VILLAGE,
  DETECTIVE: Team.VILLAGE,
  POISONER: Team.WEREWOLF,
  HUNTER: Team.VILLAGE,
  TANNER: Team.NEUTRAL,
  MASON: Team.VILLAGE,
  MAYOR: Team.VILLAGE,
};

export type PoisonerRule = "never" | "optional" | "mandatory";

export interface PlayerCountConfig {
  wolves: number;
  specialRoles: Role[];
  villagers: number;
  poisonerRule: PoisonerRule;
}

/** Implements the build spec's §2.3 role distribution table for 8-18 players. */
export const DISTRIBUTION_TABLE: Record<number, PlayerCountConfig> = {
  8: { wolves: 2, specialRoles: [Role.SEER, Role.DOCTOR], villagers: 4, poisonerRule: "never" },
  9: {
    wolves: 2,
    specialRoles: [Role.SEER, Role.DOCTOR, Role.DETECTIVE],
    villagers: 4,
    poisonerRule: "never",
  },
  10: {
    wolves: 2,
    specialRoles: [Role.SEER, Role.DOCTOR, Role.DETECTIVE, Role.MAYOR],
    villagers: 4,
    poisonerRule: "never",
  },
  11: {
    wolves: 3,
    specialRoles: [Role.SEER, Role.DOCTOR, Role.DETECTIVE, Role.MAYOR],
    villagers: 4,
    poisonerRule: "optional",
  },
  12: {
    wolves: 3,
    specialRoles: [Role.SEER, Role.DOCTOR, Role.DETECTIVE, Role.MAYOR, Role.HUNTER],
    villagers: 4,
    poisonerRule: "optional",
  },
  13: {
    wolves: 3,
    specialRoles: [Role.SEER, Role.DOCTOR, Role.DETECTIVE, Role.MAYOR, Role.HUNTER, Role.TANNER],
    villagers: 4,
    poisonerRule: "optional",
  },
  14: {
    wolves: 4,
    specialRoles: [Role.SEER, Role.DOCTOR, Role.DETECTIVE, Role.MAYOR, Role.HUNTER, Role.TANNER],
    villagers: 4,
    poisonerRule: "optional",
  },
  15: {
    wolves: 4,
    specialRoles: [
      Role.SEER,
      Role.DOCTOR,
      Role.DETECTIVE,
      Role.MAYOR,
      Role.HUNTER,
      Role.TANNER,
      Role.MASON,
      Role.MASON,
    ],
    villagers: 3,
    poisonerRule: "optional",
  },
  16: {
    wolves: 5,
    specialRoles: [
      Role.SEER,
      Role.DOCTOR,
      Role.DETECTIVE,
      Role.MAYOR,
      Role.HUNTER,
      Role.TANNER,
      Role.MASON,
      Role.MASON,
    ],
    villagers: 3,
    poisonerRule: "mandatory",
  },
  17: {
    wolves: 5,
    specialRoles: [
      Role.SEER,
      Role.DOCTOR,
      Role.DOCTOR,
      Role.DETECTIVE,
      Role.MAYOR,
      Role.HUNTER,
      Role.TANNER,
      Role.MASON,
      Role.MASON,
    ],
    villagers: 3,
    poisonerRule: "mandatory",
  },
  18: {
    wolves: 5,
    specialRoles: [
      Role.SEER,
      Role.DOCTOR,
      Role.DOCTOR,
      Role.DETECTIVE,
      Role.MAYOR,
      Role.HUNTER,
      Role.TANNER,
      Role.MASON,
      Role.MASON,
    ],
    villagers: 4,
    poisonerRule: "mandatory",
  },
};

export const MIN_PLAYERS = 8;
export const MAX_PLAYERS = 18;

export function getDistributionConfig(playerCount: number): PlayerCountConfig {
  const config = DISTRIBUTION_TABLE[playerCount];
  if (!config) {
    throw new RangeError(`Unsupported player count: ${playerCount} (must be ${MIN_PLAYERS}-${MAX_PLAYERS})`);
  }
  return config;
}
