import type { RoleName } from './roles.ts';

export type Phase = 'NIGHT' | 'DAY_DISCUSSION' | 'DAY_VOTE' | 'GAME_OVER';

export type VoteStage = 'INITIAL' | 'TIEBREAK_1' | 'TIEBREAK_2';

export interface Player {
  id: string;
  name: string;
  role: RoleName;
  alive: boolean;
}

export interface Ballot {
  voterId: string;
  targetId: string;
  stage: VoteStage;
}

export interface DetectiveResult {
  detectiveId: string;
  targetId: string;
  correct: boolean;
}

export type WinnerResult =
  | { winner: 'VILLAGE' }
  | { winner: 'WEREWOLF' }
  | { winner: 'TANNER'; tannerId: string };

export interface NightState {
  wolfProposals: Map<string, string>;
  doctorShields: Map<string, string>;
  seerQueriesUsed: Set<string>;
  detectiveGuess: { detectiveId: string; targetId: string } | null;
}

export interface DayVoteState {
  stage: VoteStage;
  ballots: Ballot[];
  tiedPlayerIds: string[] | null;
  stage2ExcludedPlayerId: string | null;
}

export interface GameState {
  players: Player[];
  phase: Phase;
  nightNumber: number;
  dayNumber: number;
  night: NightState;
  dayVote: DayVoteState | null;
  mayorVoteWeight: number;
  doctorLastTargets: Map<string, string | null>;
  vampireStolenRole: RoleName | null;
  lastNightDeath: string | null;
  lastDetectiveResult: DetectiveResult | null;
  winner: WinnerResult | null;
}

export function createInitialState(players: Player[]): GameState {
  return {
    players,
    phase: 'NIGHT',
    nightNumber: 1,
    dayNumber: 0,
    night: freshNightState(),
    dayVote: null,
    mayorVoteWeight: 1,
    doctorLastTargets: new Map(),
    vampireStolenRole: null,
    lastNightDeath: null,
    lastDetectiveResult: null,
    winner: null,
  };
}

export function freshNightState(): NightState {
  return {
    wolfProposals: new Map(),
    doctorShields: new Map(),
    seerQueriesUsed: new Set(),
    detectiveGuess: null,
  };
}
