import { isWerewolfTeam } from './roles.ts';
import type { RoleName } from './roles.ts';
import {
  createInitialState,
  freshNightState,
} from './state.ts';
import type {
  Ballot,
  DayVoteState,
  DetectiveResult,
  GameState,
  Player,
  WinnerResult,
} from './state.ts';

export interface NightResult {
  died: string | null;
  detectiveResult: DetectiveResult | null;
  winner: WinnerResult | null;
}

export type VoteRoundResult =
  | { status: 'TIE'; nextStage: 'TIEBREAK_1'; tiedPlayerIds: string[] }
  | { status: 'TIE'; nextStage: 'TIEBREAK_2'; tiedPlayerIds: string[]; excludedPlayerId: string }
  | { status: 'BANISHED'; bannedId: string; draggedDownId: string | null; winner: WinnerResult | null };

/**
 * Standard win check per spec section 7: village team = everyone not on the
 * werewolf team (Seer/Doctor/.../Tanner all count), werewolf team = Werewolf + Vampire.
 * Tanner's own-win condition (section 6) is handled separately at banishment time,
 * since it only fires on a day-vote banishment, not this headcount comparison.
 */
export function checkStandardWinCondition(players: Player[]): WinnerResult | null {
  const alive = players.filter((p) => p.alive);
  const wolfTeamCount = alive.filter((p) => isWerewolfTeam(p.role)).length;
  const villageTeamCount = alive.length - wolfTeamCount;
  if (wolfTeamCount === 0) return { winner: 'VILLAGE' };
  if (wolfTeamCount >= villageTeamCount) return { winner: 'WEREWOLF' };
  return null;
}

function activeBallotsForTally(dayVote: DayVoteState): Ballot[] {
  if (dayVote.stage === 'INITIAL') {
    return dayVote.ballots.filter((b) => b.stage === 'INITIAL');
  }
  if (dayVote.stage === 'TIEBREAK_1') {
    const tied = new Set(dayVote.tiedPlayerIds ?? []);
    const locked = dayVote.ballots.filter((b) => b.stage === 'INITIAL' && tied.has(b.targetId));
    const revotes = dayVote.ballots.filter((b) => b.stage === 'TIEBREAK_1');
    return [...locked, ...revotes];
  }
  return dayVote.ballots.filter((b) => b.stage === 'TIEBREAK_2');
}

export class GameEngine {
  state: GameState;

  constructor(players: Player[]) {
    this.state = createInitialState(players);
  }

  private requirePlayer(id: string): Player {
    const player = this.state.players.find((p) => p.id === id);
    if (!player) throw new Error(`Unknown player id: ${id}`);
    return player;
  }

  private requireDayVote(): DayVoteState {
    if (!this.state.dayVote) throw new Error('No active vote round.');
    return this.state.dayVote;
  }

  // ---- Night phase --------------------------------------------------------

  proposeWolfKill(wolfId: string, targetId: string): void {
    const wolf = this.requirePlayer(wolfId);
    if (!wolf.alive || !isWerewolfTeam(wolf.role)) {
      throw new Error(`${wolfId} is not a living werewolf-team member.`);
    }
    const target = this.requirePlayer(targetId);
    if (!target.alive) throw new Error(`${targetId} is not alive.`);
    this.state.night.wolfProposals.set(wolfId, targetId);
  }

  getWolfConsensusTarget(): string | null {
    const livingWolves = this.state.players.filter((p) => p.alive && isWerewolfTeam(p.role));
    if (livingWolves.length === 0) return null;
    const proposals = livingWolves.map((w) => this.state.night.wolfProposals.get(w.id));
    if (proposals.some((p) => p === undefined)) return null;
    const [first, ...rest] = proposals;
    return rest.every((p) => p === first) ? (first as string) : null;
  }

  seerQuery(seerId: string, targetId: string): RoleName {
    const seer = this.requirePlayer(seerId);
    if (seer.role !== 'SEER' || !seer.alive) {
      throw new Error(`${seerId} is not a living Seer.`);
    }
    if (this.state.night.seerQueriesUsed.has(seerId)) {
      throw new Error(`${seerId} has already used their Seer power tonight.`);
    }
    const target = this.requirePlayer(targetId);
    this.state.night.seerQueriesUsed.add(seerId);
    return target.role;
  }

  doctorShield(doctorId: string, targetId: string): void {
    const doctor = this.requirePlayer(doctorId);
    if (doctor.role !== 'DOCTOR' || !doctor.alive) {
      throw new Error(`${doctorId} is not a living Doctor.`);
    }
    if (this.state.night.doctorShields.has(doctorId)) {
      throw new Error(`${doctorId} has already shielded someone tonight.`);
    }
    if (this.state.doctorLastTargets.get(doctorId) === targetId) {
      throw new Error(`${doctorId} cannot shield the same target on two consecutive nights.`);
    }
    this.requirePlayer(targetId);
    this.state.night.doctorShields.set(doctorId, targetId);
  }

  detectiveGuess(detectiveId: string, targetId: string): void {
    const detective = this.requirePlayer(detectiveId);
    if (detective.role !== 'DETECTIVE' || !detective.alive) {
      throw new Error(`${detectiveId} is not a living Detective.`);
    }
    if (this.state.night.detectiveGuess) {
      throw new Error(`${detectiveId} has already guessed tonight.`);
    }
    this.requirePlayer(targetId);
    this.state.night.detectiveGuess = { detectiveId, targetId };
  }

  /** Vampire's nightly prompt: use the stolen power (if any) or decline. */
  vampireUsePower(vampireId: string, use: boolean, targetId?: string): RoleName | null {
    const vampire = this.requirePlayer(vampireId);
    if (vampire.role !== 'VAMPIRE' || !vampire.alive) {
      throw new Error(`${vampireId} is not a living Vampire.`);
    }
    if (!use || !this.state.vampireStolenRole) return null;

    const stolen = this.state.vampireStolenRole;
    if (stolen === 'SEER') {
      if (!targetId) throw new Error('Using the stolen Seer power requires a target.');
      return this.requirePlayer(targetId).role;
    }
    if (stolen === 'DOCTOR') {
      if (!targetId) throw new Error('Using the stolen Doctor power requires a target.');
      this.requirePlayer(targetId);
      this.state.night.doctorShields.set(vampireId, targetId);
      return null;
    }
    if (stolen === 'DETECTIVE') {
      if (!targetId) throw new Error('Using the stolen Detective power requires a target.');
      this.requirePlayer(targetId);
      this.state.night.detectiveGuess = { detectiveId: vampireId, targetId };
      return null;
    }
    // Villager, Hunter, Tanner, Mayor, Mason have no night action to steal.
    return null;
  }

  getMasonPartner(playerId: string): Player | null {
    const player = this.requirePlayer(playerId);
    if (player.role !== 'MASON') return null;
    return this.state.players.find((p) => p.role === 'MASON' && p.id !== playerId) ?? null;
  }

  resolveNight(): NightResult {
    const targetId = this.getWolfConsensusTarget();
    if (!targetId) {
      throw new Error('Werewolves have not reached unanimous agreement on a kill target.');
    }
    const target = this.requirePlayer(targetId);
    const shielded = new Set(this.state.night.doctorShields.values()).has(targetId);

    if (shielded) {
      this.state.lastNightDeath = null;
    } else {
      target.alive = false;
      this.state.vampireStolenRole = target.role;
      this.state.lastNightDeath = targetId;
    }

    const guess = this.state.night.detectiveGuess;
    this.state.lastDetectiveResult = guess
      ? {
          detectiveId: guess.detectiveId,
          targetId: guess.targetId,
          correct: isWerewolfTeam(this.requirePlayer(guess.targetId).role),
        }
      : null;

    for (const [doctorId, shieldTarget] of this.state.night.doctorShields) {
      this.state.doctorLastTargets.set(doctorId, shieldTarget);
    }

    const standard = checkStandardWinCondition(this.state.players);
    if (standard) {
      this.state.winner = standard;
      this.state.phase = 'GAME_OVER';
    } else {
      this.state.phase = 'DAY_DISCUSSION';
      this.state.dayNumber += 1;
    }

    return {
      died: this.state.lastNightDeath,
      detectiveResult: this.state.lastDetectiveResult,
      winner: this.state.winner,
    };
  }

  // ---- Day phase -----------------------------------------------------------

  startVoting(): void {
    if (this.state.phase !== 'DAY_DISCUSSION') {
      throw new Error('Voting can only start after the day discussion phase.');
    }
    this.state.phase = 'DAY_VOTE';
    this.state.dayVote = {
      stage: 'INITIAL',
      ballots: [],
      tiedPlayerIds: null,
      stage2ExcludedPlayerId: null,
    };
  }

  /** Mayor may call this instead of castVote to stack their vote for a future round. */
  saveMayorVote(mayorId: string): void {
    const dayVote = this.requireDayVote();
    if (dayVote.stage !== 'INITIAL') {
      throw new Error('The Mayor can only save their vote during the initial vote of the day.');
    }
    const mayor = this.requirePlayer(mayorId);
    if (mayor.role !== 'MAYOR' || !mayor.alive) {
      throw new Error(`${mayorId} is not the living Mayor.`);
    }
    this.state.mayorVoteWeight += 1;
  }

  castVote(voterId: string, targetId: string): void {
    const dayVote = this.requireDayVote();
    const voter = this.requirePlayer(voterId);
    if (!voter.alive) throw new Error(`${voterId} is not alive and cannot vote.`);
    const target = this.requirePlayer(targetId);
    if (!target.alive) throw new Error(`Cannot vote for ${targetId}, they are not alive.`);

    if (dayVote.stage !== 'INITIAL') {
      const tied = dayVote.tiedPlayerIds ?? [];
      if (!tied.includes(targetId)) {
        throw new Error(`During this tie-break revote, votes may only go to: ${tied.join(', ')}.`);
      }
    }
    if (dayVote.stage === 'TIEBREAK_2' && dayVote.stage2ExcludedPlayerId === voterId) {
      throw new Error(`${voterId} was randomly excluded from this revote.`);
    }

    const weight = voter.role === 'MAYOR' ? this.state.mayorVoteWeight : 1;
    for (let i = 0; i < weight; i++) {
      dayVote.ballots.push({ voterId, targetId, stage: dayVote.stage });
    }
    if (voter.role === 'MAYOR') {
      this.state.mayorVoteWeight = 1;
    }
  }

  tally(): Map<string, number> {
    const dayVote = this.requireDayVote();
    const counts = new Map<string, number>();
    for (const ballot of activeBallotsForTally(dayVote)) {
      counts.set(ballot.targetId, (counts.get(ballot.targetId) ?? 0) + 1);
    }
    return counts;
  }

  resolveVoteRound(rng: () => number = Math.random): VoteRoundResult {
    const dayVote = this.requireDayVote();
    const counts = this.tally();
    if (counts.size === 0) throw new Error('No votes have been cast yet.');

    const max = Math.max(...counts.values());
    const top = [...counts.entries()].filter(([, c]) => c === max).map(([id]) => id);

    if (top.length === 1) {
      return this.finishVote(top[0]!);
    }

    if (dayVote.stage === 'INITIAL') {
      dayVote.tiedPlayerIds = top;
      dayVote.stage = 'TIEBREAK_1';
      return { status: 'TIE', nextStage: 'TIEBREAK_1', tiedPlayerIds: top };
    }

    if (dayVote.stage === 'TIEBREAK_1') {
      const alive = this.state.players.filter((p) => p.alive);
      const excluded = alive[Math.floor(rng() * alive.length)]!;
      dayVote.stage2ExcludedPlayerId = excluded.id;
      dayVote.stage = 'TIEBREAK_2';
      return {
        status: 'TIE',
        nextStage: 'TIEBREAK_2',
        tiedPlayerIds: dayVote.tiedPlayerIds ?? [],
        excludedPlayerId: excluded.id,
      };
    }

    // Spec assumes excluding one voter always forces an odd, decisive stage-2
    // revote between exactly two candidates; it doesn't define what happens
    // if that assumption fails, so surface it rather than guessing.
    throw new Error('Stage-2 revote is still tied; the spec does not define a further tiebreaker.');
  }

  private finishVote(bannedId: string): VoteRoundResult {
    const banished = this.banishPlayer(bannedId);
    const dragged = this.applyHunterDragDown(banished);

    const tannerWinner = [banished, dragged].find((p): p is Player => !!p && p.role === 'TANNER');
    if (tannerWinner) {
      this.state.winner = { winner: 'TANNER', tannerId: tannerWinner.id };
      this.state.phase = 'GAME_OVER';
      return { status: 'BANISHED', bannedId, draggedDownId: dragged?.id ?? null, winner: this.state.winner };
    }

    const standard = checkStandardWinCondition(this.state.players);
    if (standard) {
      this.state.winner = standard;
      this.state.phase = 'GAME_OVER';
    } else {
      this.advanceToNextNight();
    }
    return { status: 'BANISHED', bannedId, draggedDownId: dragged?.id ?? null, winner: this.state.winner };
  }

  private banishPlayer(id: string): Player {
    const player = this.requirePlayer(id);
    player.alive = false;
    return player;
  }

  /** Spec 5.4: Hunter banished by day vote drags down whoever they last voted for this round. */
  private applyHunterDragDown(banished: Player): Player | null {
    if (banished.role !== 'HUNTER') return null;
    const dayVote = this.state.dayVote;
    if (!dayVote) return null;

    const hunterBallots = dayVote.ballots.filter((b) => b.voterId === banished.id);
    const lastBallot = hunterBallots[hunterBallots.length - 1];
    if (!lastBallot) return null;

    const target = this.state.players.find((p) => p.id === lastBallot.targetId);
    if (!target || !target.alive) return null;
    target.alive = false;
    return target;
  }

  private advanceToNextNight(): void {
    this.state.phase = 'NIGHT';
    this.state.nightNumber += 1;
    this.state.dayVote = null;
    this.state.night = freshNightState();
  }
}
