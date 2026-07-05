import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRolePool,
  resolveVampireInclusion,
  getVampireRule,
  getWerewolfCount,
  assignRolesRandomly,
  validateHandPickedAssignment,
} from '../setup.ts';

function countRoles(pool: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const role of pool) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}

test('8 players: 2 wolves, no vampire possible, Seer + Doctor + 4 villagers', () => {
  assert.equal(getWerewolfCount(8), 2);
  assert.equal(getVampireRule(8), 'NEVER');
  assert.equal(resolveVampireInclusion(8, 'AI', { rng: () => 0 }), false);

  const pool = buildRolePool(8, false);
  assert.equal(pool.length, 8);
  assert.deepEqual(countRoles(pool), { WEREWOLF: 2, SEER: 1, DOCTOR: 1, VILLAGER: 4 });
});

test('13 players: 3 wolves, Tanner introduced, vampire optional', () => {
  assert.equal(getWerewolfCount(13), 3);
  assert.equal(getVampireRule(13), 'OPTIONAL');

  const withoutVampire = buildRolePool(13, false);
  assert.deepEqual(countRoles(withoutVampire), {
    WEREWOLF: 3,
    SEER: 1,
    DOCTOR: 1,
    DETECTIVE: 1,
    MAYOR: 1,
    HUNTER: 1,
    TANNER: 1,
    VILLAGER: 4,
  });

  const withVampire = buildRolePool(13, true);
  assert.deepEqual(countRoles(withVampire), {
    WEREWOLF: 2,
    VAMPIRE: 1,
    SEER: 1,
    DOCTOR: 1,
    DETECTIVE: 1,
    MAYOR: 1,
    HUNTER: 1,
    TANNER: 1,
    VILLAGER: 4,
  });
});

test('17 players: 5 wolves, vampire mandatory, two Doctors', () => {
  assert.equal(getWerewolfCount(17), 5);
  assert.equal(getVampireRule(17), 'MANDATORY');
  assert.equal(resolveVampireInclusion(17, 'HUMAN', { humanChoice: false }), true);

  const pool = buildRolePool(17, true);
  assert.equal(pool.length, 17);
  assert.deepEqual(countRoles(pool), {
    WEREWOLF: 4,
    VAMPIRE: 1,
    SEER: 1,
    DOCTOR: 2,
    DETECTIVE: 1,
    MAYOR: 1,
    HUNTER: 1,
    TANNER: 1,
    MASON: 2,
    VILLAGER: 3,
  });
});

test('vampire inclusion rule: never at 2 wolves, mandatory at 5, host choice at 3-4', () => {
  // 8-10 players -> 2 wolves -> never, regardless of host type/choice.
  for (const count of [8, 9, 10]) {
    assert.equal(resolveVampireInclusion(count, 'HUMAN', { humanChoice: true }), false);
  }
  // 16-18 players -> 5 wolves -> mandatory, regardless of host type/choice.
  for (const count of [16, 17, 18]) {
    assert.equal(resolveVampireInclusion(count, 'HUMAN', { humanChoice: false }), true);
  }
  // 11-15 players -> optional: human host's explicit choice wins.
  assert.equal(resolveVampireInclusion(12, 'HUMAN', { humanChoice: true }), true);
  assert.equal(resolveVampireInclusion(12, 'HUMAN', { humanChoice: false }), false);
  // AI host decides randomly off the injected rng.
  assert.equal(resolveVampireInclusion(12, 'AI', { rng: () => 0.1 }), true);
  assert.equal(resolveVampireInclusion(12, 'AI', { rng: () => 0.9 }), false);
});

test('assignRolesRandomly deals every role in the pool to exactly one player', () => {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  const pool = buildRolePool(8, false);
  const assignment = assignRolesRandomly(playerIds, pool, () => 0.42);

  assert.equal(assignment.size, 8);
  assert.deepEqual(countRoles([...assignment.values()]), countRoles(pool));
  assert.throws(() => assignRolesRandomly(playerIds.slice(0, 7), pool));
});

test('validateHandPickedAssignment catches wrong role counts', () => {
  const pool = buildRolePool(8, false);
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  const good = assignRolesRandomly(playerIds, pool, () => 0.1);
  assert.equal(validateHandPickedAssignment(good, pool).valid, true);

  const bad = new Map(good);
  // Turn a villager into a second Doctor -> composition no longer matches the pool.
  const villagerEntry = [...bad.entries()].find(([, role]) => role === 'VILLAGER')!;
  bad.set(villagerEntry[0], 'DOCTOR');
  const result = validateHandPickedAssignment(bad, pool);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('DOCTOR')));
});
