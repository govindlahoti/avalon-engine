const {roleIds} = require('../configs/roles.config');
const Player    = require('../src/player');
const Role      = require('../src/role');
const Vote      = require('../src/vote');

let player;
beforeEach(() => {
  player = new Player('user-1');
});

test('should return a username', () => {
  expect(player.getUsername()).toEqual('user-1');
});

test('should return a role', () => {
  expect(player.getRole()).toBeFalsy();

  const role = new Role(roleIds.MERLIN);
  player.setRole(role);

  expect(player.getRole()).toEqual(role);
});

test('should say if can see another player', () => {
  const player1 = new Player('user-1');
  player1.setRole(new Role(roleIds.MERLIN));

  const player2 = new Player('user-2');
  player2.setRole(new Role(roleIds.MINION_1));

  expect(player1.canSee(player2)).toBeTruthy();
  expect(player2.canSee(player1)).toBeFalsy();
});

test('should assign a vote', () => {
  expect(player.getVote()).toBeFalsy();

  player.setVote(new Vote('user-1', true));

  expect(player.getVote()).toBeTruthy();
});

describe('assassination', () => {
  test('should be assassinated', () => {
    expect(player.getIsAssassinated()).toBeFalsy();

    player.markAsAssassinated();

    expect(player.getIsAssassinated()).toBeTruthy();
  });
});

describe('serialization', () => {
  test('should return it\'s field values as an object', () => {
    const actual   = player.serialize();
    const expected = {
      username: 'user-1',
      role: null,
      vote: null,
      isAssassinated: false,
    };

    expect(actual).toEqual(expected);
  });

  test('should contain a serialized vote', () => {
    const vote = new Vote('user-1', true);
    player.setVote(vote);

    expect(player.serialize().vote).toEqual(vote.serialize());
  });

  test('should contain a serialized role', () => {
    const role = new Role(roleIds.MORDRED);
    player.setRole(role);

    expect(player.serialize().role).toEqual(role.serialize());
  });
});
