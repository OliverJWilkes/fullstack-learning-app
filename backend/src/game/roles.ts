export type Team = 'VILLAGE' | 'WEREWOLF';

export type RoleName =
  | 'VILLAGER'
  | 'WEREWOLF'
  | 'VAMPIRE'
  | 'SEER'
  | 'DOCTOR'
  | 'DETECTIVE'
  | 'HUNTER'
  | 'MASON'
  | 'TANNER'
  | 'MAYOR';

const ROLE_TEAM: Record<RoleName, Team> = {
  VILLAGER: 'VILLAGE',
  WEREWOLF: 'WEREWOLF',
  VAMPIRE: 'WEREWOLF',
  SEER: 'VILLAGE',
  DOCTOR: 'VILLAGE',
  DETECTIVE: 'VILLAGE',
  HUNTER: 'VILLAGE',
  MASON: 'VILLAGE',
  TANNER: 'VILLAGE',
  MAYOR: 'VILLAGE',
};

export function teamOf(role: RoleName): Team {
  return ROLE_TEAM[role];
}

export function isWerewolfTeam(role: RoleName): boolean {
  return teamOf(role) === 'WEREWOLF';
}
