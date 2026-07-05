import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, checkStandardWinCondition } from '../engine.ts';
import type { Player } from '../state.ts';

function player(id: string, role: Player['role']): Player {
  return { id, name: id, role, alive: true };
}

test('werewolves must reach unanimous agreement before a night resolves', () => {
  const engine = new GameEngine([
    player('w1', 'WEREWOLF'),
    player('w2', 'WEREWOLF'),
    player('seer', 'SEER'),
    player('doc', 'DOCTOR'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
  ]);

  engine.proposeWolfKill('w1', 'v1');
  assert.equal(engine.getWolfConsensusTarget(), null);
  assert.throws(() => engine.resolveNight());

  engine.proposeWolfKill('w2', 'v2');
  assert.equal(engine.getWolfConsensusTarget(), null, 'wolves disagree, no consensus yet');

  engine.proposeWolfKill('w2', 'v1');
  assert.equal(engine.getWolfConsensusTarget(), 'v1');
});

test('Doctor shield saves the kill target and cannot repeat on consecutive nights', () => {
  const engine = new GameEngine([
    player('w1', 'WEREWOLF'),
    player('w2', 'WEREWOLF'),
    player('doc', 'DOCTOR'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
    player('v5', 'VILLAGER'),
  ]);

  engine.proposeWolfKill('w1', 'v1');
  engine.proposeWolfKill('w2', 'v1');
  engine.doctorShield('doc', 'v1');
  const nightResult = engine.resolveNight();

  assert.equal(nightResult.died, null, 'shielded target survives');
  assert.equal(engine.state.players.find((p) => p.id === 'v1')!.alive, true);
  assert.equal(engine.state.phase, 'DAY_DISCUSSION');

  // Run a day round so we can reach night 2 (banish someone other than the doctor or v1).
  engine.startVoting();
  for (const voter of ['w1', 'w2', 'v1', 'v2', 'v3', 'v4', 'v5']) {
    engine.castVote(voter, 'v5');
  }
  engine.resolveVoteRound();
  assert.equal(engine.state.phase, 'NIGHT');
  assert.equal(engine.state.nightNumber, 2);

  assert.throws(
    () => engine.doctorShield('doc', 'v1'),
    /consecutive/,
    'same target on back-to-back nights should be rejected',
  );
  // A different target is fine.
  engine.doctorShield('doc', 'v2');
});

test('Detective correctly identifies a Werewolf, and a Vampire counts as a werewolf found', () => {
  const engine = new GameEngine([
    player('det', 'DETECTIVE'),
    player('wolf', 'WEREWOLF'),
    player('vamp', 'VAMPIRE'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
    player('v5', 'VILLAGER'),
    player('v6', 'VILLAGER'),
  ]);

  engine.detectiveGuess('det', 'vamp');
  engine.proposeWolfKill('wolf', 'v1');
  engine.proposeWolfKill('vamp', 'v1');
  const result = engine.resolveNight();

  assert.deepEqual(result.detectiveResult, { detectiveId: 'det', targetId: 'vamp', correct: true });
});

test('Detective guessing a villager is wrong', () => {
  const engine = new GameEngine([
    player('det', 'DETECTIVE'),
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
  ]);

  engine.detectiveGuess('det', 'v1');
  engine.proposeWolfKill('wolf1', 'v2');
  engine.proposeWolfKill('wolf2', 'v2');
  const result = engine.resolveNight();

  assert.deepEqual(result.detectiveResult, { detectiveId: 'det', targetId: 'v1', correct: false });
});

test('Vampire steals the kill victim\'s power, which persists until the wolves kill again', () => {
  const engine = new GameEngine([
    player('wolf', 'WEREWOLF'),
    player('vamp', 'VAMPIRE'),
    player('doc', 'DOCTOR'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
    player('v5', 'VILLAGER'),
    player('v6', 'VILLAGER'),
  ]);

  // Night 1: wolves kill the Doctor. Vampire steals the Doctor's shield power.
  engine.proposeWolfKill('wolf', 'doc');
  engine.proposeWolfKill('vamp', 'doc');
  engine.doctorShield('doc', 'v1'); // doctor still gets to act before dying tonight
  engine.resolveNight();
  assert.equal(engine.state.players.find((p) => p.id === 'doc')!.alive, false);
  assert.equal(engine.state.vampireStolenRole, 'DOCTOR');

  // Day 1: banish someone irrelevant to keep the game going.
  engine.startVoting();
  for (const voter of ['wolf', 'vamp', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
    engine.castVote(voter, 'v2');
  }
  engine.resolveVoteRound();
  assert.equal(engine.state.nightNumber, 2);

  // Night 2: the wolves target v3, but the Vampire uses the stolen Doctor
  // power to shield v3, saving them from their own team's kill.
  const stolenRole = engine.vampireUsePower('vamp', true, 'v3');
  assert.equal(stolenRole, null, 'stolen Doctor power has no return value, unlike stolen Seer');
  engine.proposeWolfKill('wolf', 'v3');
  engine.proposeWolfKill('vamp', 'v3');
  const night2 = engine.resolveNight();

  assert.equal(night2.died, null, 'v3 was shielded by the stolen Doctor power');
  assert.equal(
    engine.state.vampireStolenRole,
    'DOCTOR',
    'no new kill happened, so the stolen power is not replaced or lost',
  );
});

test('Mayor can save a vote to stack it, then cast the full stacked weight later', () => {
  const engine = new GameEngine([
    player('mayor', 'MAYOR'),
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
    player('v5', 'VILLAGER'),
    player('v6', 'VILLAGER'),
    player('v7', 'VILLAGER'),
  ]);

  // Night 1: wolves kill v7, uncontested.
  engine.proposeWolfKill('wolf1', 'v7');
  engine.proposeWolfKill('wolf2', 'v7');
  engine.resolveNight();

  // Day 1: Mayor saves instead of voting; wolf1 is banished by plain majority.
  engine.startVoting();
  engine.saveMayorVote('mayor');
  assert.equal(engine.state.mayorVoteWeight, 2);
  for (const voter of ['wolf1', 'wolf2']) engine.castVote(voter, 'v1');
  for (const voter of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) engine.castVote(voter, 'wolf1');
  const day1 = engine.resolveVoteRound();
  assert.equal(day1.status, 'BANISHED');
  assert.equal(engine.state.mayorVoteWeight, 2, 'weight persists since the Mayor did not vote');

  // Night 2: the lone remaining wolf kills v6.
  engine.proposeWolfKill('wolf2', 'v6');
  engine.resolveNight();

  // Day 2: Mayor uses the stacked vote of weight 2 alone against the last wolf.
  engine.startVoting();
  engine.castVote('mayor', 'wolf2');
  assert.equal(engine.tally().get('wolf2'), 2, 'a stacked vote of 2 counts as 2 separate ballots');
  assert.equal(engine.state.mayorVoteWeight, 1, 'weight resets once used');

  const day2 = engine.resolveVoteRound();
  assert.equal(day2.status, 'BANISHED');
  assert.deepEqual(engine.state.winner, { winner: 'VILLAGE' });
});

test('a tied vote goes to a stage-1 revote among the non-tied voters, and resolves', () => {
  const engine = new GameEngine([
    player('p1', 'WEREWOLF'),
    player('p2', 'VILLAGER'),
    player('p3', 'VILLAGER'),
    player('p4', 'VILLAGER'),
    player('p5', 'VILLAGER'),
  ]);
  engine.state.phase = 'DAY_DISCUSSION';
  engine.startVoting();

  engine.castVote('p1', 'p2');
  engine.castVote('p4', 'p3');
  engine.castVote('p2', 'p3');
  engine.castVote('p3', 'p2');
  engine.castVote('p5', 'p4'); // p5 didn't vote for either tied candidate

  const initial = engine.resolveVoteRound();
  assert.deepEqual(initial, { status: 'TIE', nextStage: 'TIEBREAK_1', tiedPlayerIds: ['p2', 'p3'] });
  assert.deepEqual(engine.tally(), new Map([['p2', 2], ['p3', 2]]));

  assert.throws(() => engine.castVote('p1', 'p4'), /tie-break revote/);
  engine.castVote('p5', 'p2');

  const stage1 = engine.resolveVoteRound();
  assert.deepEqual(stage1, {
    status: 'BANISHED',
    bannedId: 'p2',
    draggedDownId: null,
    winner: engine.state.winner,
  });
});

test('a still-tied stage-1 revote escalates to stage 2 with one random exclusion', () => {
  const engine = new GameEngine([
    player('r1', 'WEREWOLF'),
    player('r2', 'VILLAGER'),
    player('r3', 'VILLAGER'),
    player('r4', 'VILLAGER'),
  ]);
  engine.state.phase = 'DAY_DISCUSSION';
  engine.startVoting();

  // Everyone votes for one of two candidates from the start, so there are no
  // "non-tied" voters left to revote in stage 1 - it stays deadlocked.
  engine.castVote('r1', 'r3');
  engine.castVote('r2', 'r4');
  engine.castVote('r3', 'r4');
  engine.castVote('r4', 'r3');

  const initial = engine.resolveVoteRound();
  assert.deepEqual(initial, { status: 'TIE', nextStage: 'TIEBREAK_1', tiedPlayerIds: ['r3', 'r4'] });

  const stillTied = engine.resolveVoteRound(() => 0); // rng picks alive[0] = r1 for exclusion
  assert.deepEqual(stillTied, {
    status: 'TIE',
    nextStage: 'TIEBREAK_2',
    tiedPlayerIds: ['r3', 'r4'],
    excludedPlayerId: 'r1',
  });

  assert.throws(() => engine.castVote('r1', 'r3'), /excluded/);
  engine.castVote('r2', 'r3');
  engine.castVote('r3', 'r4');
  engine.castVote('r4', 'r3');

  const final = engine.resolveVoteRound();
  assert.equal(final.status, 'BANISHED');
  assert.equal((final as { bannedId: string }).bannedId, 'r3');
});

test('Hunter banished by day vote drags down whoever they voted for', () => {
  const engine = new GameEngine([
    player('hunter', 'HUNTER'),
    player('target', 'VILLAGER'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
  ]);
  engine.state.phase = 'DAY_DISCUSSION';
  engine.startVoting();

  engine.castVote('hunter', 'target');
  engine.castVote('target', 'v1');
  for (const voter of ['wolf1', 'wolf2', 'v1', 'v2', 'v3']) engine.castVote(voter, 'hunter');

  const result = engine.resolveVoteRound();
  assert.equal(result.status, 'BANISHED');
  assert.equal((result as { draggedDownId: string }).draggedDownId, 'target');
  assert.equal(engine.state.players.find((p) => p.id === 'target')!.alive, false);
});

test('Hunter killed by werewolves at night does NOT trigger the drag-down', () => {
  const engine = new GameEngine([
    player('hunter', 'HUNTER'),
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
  ]);
  engine.proposeWolfKill('wolf1', 'hunter');
  engine.proposeWolfKill('wolf2', 'hunter');
  const result = engine.resolveNight();
  assert.equal(result.died, 'hunter');
  assert.ok(engine.state.players.filter((p) => p.alive).every((p) => p.id !== 'hunter'));
});

test('Tanner banished by day vote wins immediately, even if wolves would otherwise still be losing', () => {
  const engine = new GameEngine([
    player('tanner', 'TANNER'),
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
  ]);
  engine.state.phase = 'DAY_DISCUSSION';
  engine.startVoting();
  for (const voter of ['wolf1', 'wolf2', 'v1', 'v2', 'v3', 'v4']) engine.castVote(voter, 'tanner');
  engine.castVote('tanner', 'v1');

  const result = engine.resolveVoteRound();
  assert.equal(result.status, 'BANISHED');
  assert.deepEqual(engine.state.winner, { winner: 'TANNER', tannerId: 'tanner' });
  assert.equal(engine.state.phase, 'GAME_OVER');
});

test('Tanner killed by werewolves at night simply loses and the game continues', () => {
  const engine = new GameEngine([
    player('tanner', 'TANNER'),
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
    player('v3', 'VILLAGER'),
    player('v4', 'VILLAGER'),
  ]);
  engine.proposeWolfKill('wolf1', 'tanner');
  engine.proposeWolfKill('wolf2', 'tanner');
  engine.resolveNight();

  assert.equal(engine.state.winner, null, 'no special win, game continues normally');
  assert.equal(engine.state.phase, 'DAY_DISCUSSION');
  assert.equal(engine.state.players.find((p) => p.id === 'tanner')!.alive, false);
});

test('standard win condition counts the whole Village team, not just plain Villagers', () => {
  const players: Player[] = [
    player('wolf1', 'WEREWOLF'),
    player('wolf2', 'WEREWOLF'),
    player('seer', 'SEER'),
    player('mayor', 'MAYOR'),
    { ...player('dead-villager', 'VILLAGER'), alive: false },
  ];
  // 2 wolves vs 2 village-team (Seer + Mayor) alive -> wolves equal villagers -> werewolves win.
  assert.deepEqual(checkStandardWinCondition(players), { winner: 'WEREWOLF' });
});

test('standard win condition: village wins once every werewolf-team member is gone', () => {
  const players: Player[] = [
    { ...player('wolf', 'WEREWOLF'), alive: false },
    player('v1', 'VILLAGER'),
    player('v2', 'VILLAGER'),
  ];
  assert.deepEqual(checkStandardWinCondition(players), { winner: 'VILLAGE' });
});

test('Masons learn who the other Mason is', () => {
  const engine = new GameEngine([
    player('m1', 'MASON'),
    player('m2', 'MASON'),
    player('v1', 'VILLAGER'),
  ]);
  assert.equal(engine.getMasonPartner('m1')!.id, 'm2');
  assert.equal(engine.getMasonPartner('v1'), null);
});
