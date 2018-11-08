const _              = require('lodash');
const errors         = require('./errors');
const {roleIds}      = require('./roles.config');
const Game           = require('./game.js');
const Player         = require('./player');
const PlayersManager = require('./players-manager');
const QuestsManager  = require('./quests-manager');

describe('initialization', () => {
  test('should set creation date', () => {
    const game = new Game();

    expect(game.getCreatedAt() instanceof Date).toStrictEqual(true);
  });

  test('should mark the game as finished', () => {
    const game = new Game();

    expect(game.getFinishedAt()).toBeDefined();
    expect(game.getFinishedAt()).toBeFalsy();

    game.finish();

    expect(game.getFinishedAt() instanceof Date).toStrictEqual(true);
  });

  test('should be assigned a unique id', () => {
    const game1 = new Game();
    const game2 = new Game();

    expect(game1.getId()).not.toEqual(game2.getId());
  });
});

describe('game start', () => {
  test('should not add a player when the game is started', () => {
    const game = new Game();

    _.times(5, (i) => game.addPlayer(new Player(`user-${i}`)));

    game.start();

    expect(() => game.addPlayer(new Player('user-6'))).toThrow(errors.GAME_ALREADY_STARTED);
  });

  test('should not start the game if the player count is not enough', () => {
    const game = new Game();

    _.times(4, (i) => game.addPlayer(new Player(`user-${i}`)));

    expect(() => game.start()).toThrow(errors.INCORRECT_NUMBER_OF_PLAYERS);
  });

  test('should mark the game as started', () => {
    const game = new Game();

    _.times(8, (i) => game.addPlayer(new Player(`user-${i}`)));

    expect(game.getStartedAt()).toBeDefined();
    expect(game.getStartedAt()).toBeFalsy();

    game.start();

    expect(game.getStartedAt() instanceof Date).toStrictEqual(true);
  });

  test('should load the level preset appropriate to the player count', () => {
    const game        = new Game();
    const playerCount = 8;

    _.times(playerCount, (i) => game.addPlayer(new Player(`user-${i}`)));

    game.start();

    const goodCount = game.getLevelPreset().getGoodCount();
    const evilCount = game.getLevelPreset().getEvilCount();

    expect(goodCount + evilCount).toEqual(playerCount);
  });

  test('should assign roles', () => {
    const playersManager = new PlayersManager();
    const game           = new Game(playersManager);
    jest.spyOn(playersManager, 'assignRoles');

    _.times(5, (i) => game.addPlayer(new Player(`user-${i}`)));

    expect(playersManager.assignRoles).toBeCalledTimes(0);

    game.start();

    expect(playersManager.assignRoles).toBeCalledTimes(1);
  });

  test('should initialize quests', () => {
    const questsManager = new QuestsManager();
    const game          = new Game(new PlayersManager(), questsManager);
    jest.spyOn(questsManager, 'init');

    _.times(5, (i) => game.addPlayer(new Player(`user-${i}`)));

    expect(questsManager.init).toBeCalledTimes(0);

    game.start();

    expect(questsManager.init).toBeCalledTimes(1);
  });
});

describe('reveal roles', () => {
  test('should reveal the roles', () => {
    const game = new Game();

    expect(game.getRolesAreRevealed()).toBeDefined();
    expect(game.getRolesAreRevealed()).toBeFalsy();

    game.revealRoles();

    expect(game.getRolesAreRevealed()).toBeTruthy();
  });

  test('should conceal roles after specified seconds', (done) => {
    jest.useFakeTimers();

    const game = new Game();

    game.revealRoles(10);

    setTimeout(() => {
      expect(game.getRolesAreRevealed()).toBeFalsy();

      done();
    }, 11 * 1000);

    jest.runAllTimers();
  });

  test('should return a promise which will resolve after the roles are concealed', (done) => {
    jest.useFakeTimers();

    const game = new Game();

    const p = game.revealRoles(10).then(() => {
      expect(game.getRolesAreRevealed()).toBeFalsy();

      done();
    });

    expect(p instanceof Promise).toBeTruthy();

    jest.runAllTimers();
  });

  test('should return the old promise if it hasn\'t resolved yet', () => {
    const game = new Game();

    const p1 = game.revealRoles(10);
    const p2 = game.revealRoles(10);

    expect(p1).toBe(p2);
  });

  test('should return a new promise if the old one has resolved', () => {
    jest.useFakeTimers();

    const game = new Game();

    const p1 = game.revealRoles(10);

    jest.advanceTimersByTime(11 * 1000);

    const p2 = game.revealRoles(10);

    expect(p1).not.toBe(p2);
  });
});

describe('post "reveal roles" phase', () => {
  let game;
  let playersManager;
  let questsManager;

  beforeEach(() => {
    jest.useFakeTimers();

    playersManager = new PlayersManager();
    questsManager  = new QuestsManager();
    game           = new Game(playersManager, questsManager);

    _.times(7, (i) => game.addPlayer(new Player(`user-${i}`)));

    game.start();
    game.revealRoles(10);

    jest.runAllTimers();
  });

  const passQuestsWithResults = (results = []) => {
    _.times(results.length, () => {
      const usernames = [];

      _.times(
        questsManager.getCurrentQuest().getVotesNeeded(),
        (i) => usernames.push(`user-${i}`)
      );

      proposeAndSubmitTeam(usernames);

      voteAllForTeam(true);

      voteAllForQuest(true);
    });
  };

  const proposeAndSubmitTeam = (usernames = []) => {
    const leaderUsername = playersManager.getLeader().getUsername();

    proposePlayers(usernames);

    game.submitTeam(leaderUsername);
  };

  const proposePlayers = (usernames = []) => {
    const leaderUsername = playersManager.getLeader().getUsername();

    usernames.forEach((username) => {
      game.toggleIsProposed(leaderUsername, username);
    });
  };

  const voteAllForTeam = (voteValue) => {
    playersManager.getAll()
      .forEach(p => game.voteForTeam(p.getUsername(), voteValue));
  };

  const voteAllForQuest = (voteValue) => {
    playersManager.getProposedPlayers()
      .forEach(p => game.voteForQuest(p.getUsername(), voteValue));
  };

  describe('team proposal', () => {
    test('should disallow anybody other then the party leader to propose a player', () => {
      const leader = playersManager.getLeader();
      expect(() => game.toggleIsProposed(leader.getUsername(), 'user-3')).not.toThrow();

      const nonLeader = playersManager.getAll().find(player => !player.getIsLeader());
      expect(() => {
        game.toggleIsProposed(nonLeader.getUsername(), 'user-3');
      }).toThrow(errors.NO_RIGHT_TO_PROPOSE);
    });

    test('should toggle whether a player is proposed or not', () => {
      const leader = playersManager.getLeader();

      jest.spyOn(playersManager, 'toggleIsProposed');

      game.toggleIsProposed(leader.getUsername(), 'user-3');

      expect(playersManager.toggleIsProposed).toBeCalledTimes(1);
    });

    test('should disallow any further proposals once the team is submitted', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      expect(() => game.toggleIsProposed(playersManager.getLeader().getUsername(), 'user-2'))
        .toThrow(errors.NO_PROPOSITION_TIME);
    });
  });

  describe('team submission', () => {
    test('should disallow team submission by a non-leader player', () => {
      const nonLeaderUsername = playersManager.getAll().find(p => !p.getIsLeader());

      expect(() => game.submitTeam(nonLeaderUsername))
        .toThrow(errors.NO_RIGHT_TO_SUBMIT_TEAM);
    });

    test('should disallow submission if not enough players are proposed', () => {
      expect(() => game.submitTeam(playersManager.getLeader().getUsername()))
        .toThrow(errors.INCORRECT_NUMBER_OF_PLAYERS);

      game.toggleIsProposed(playersManager.getLeader().getUsername(), 'user-1');

      expect(() => game.submitTeam(playersManager.getLeader().getUsername()))
        .toThrow(errors.INCORRECT_NUMBER_OF_PLAYERS);

      game.toggleIsProposed(playersManager.getLeader().getUsername(), 'user-2');

      expect(game.submitTeam(playersManager.getLeader().getUsername()));
    });

    test('should submit proposed players', () => {
      proposePlayers(['user-1', 'user-2']);

      expect(playersManager.getIsSubmitted()).toBeFalsy();

      game.submitTeam(playersManager.getLeader().getUsername());

      expect(playersManager.getIsSubmitted()).toBeTruthy();
    });
  });

  describe('team voting', () => {
    test('should only allow to vote when the team is submitted', () => {
      proposePlayers(['user-1', 'user-2']);

      expect(() => game.voteForTeam('user-1', true)).toThrow(errors.NO_VOTING_TIME);

      game.submitTeam(playersManager.getLeader().getUsername());

      expect(() => game.voteForTeam('user-1', false)).not.toThrow();
    });

    test('should only allow to vote to an existing player', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      expect(() => game.voteForTeam('user-3', true)).not.toThrow();
      expect(() => game.voteForTeam('nonexistent', true)).toThrow(errors.NO_RIGHT_TO_VOTE);
    });

    test('should only allow voting once', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      game.voteForTeam('user-1', true);

      expect(() => game.voteForTeam('user-1', true)).toThrow(errors.NO_RIGHT_TO_VOTE);
    });

    test('should persist the vote in quest history', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      jest.spyOn(questsManager, 'addVote');
      game.voteForTeam('user-1', true);

      expect(questsManager.addVote).toBeCalledTimes(1);
    });

    test('should reset the votes when the team voting was successful', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      jest.spyOn(questsManager, 'addVote');

      voteAllForTeam(true);

      expect(playersManager.getAll()[0].getVote()).toBeFalsy();
    });

    test('should reset the votes even when the team got rejected', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      jest.spyOn(questsManager, 'addVote');

      voteAllForTeam(false);

      expect(playersManager.getAll()[0].getVote()).toBeFalsy();
    });

    test('should unmark the team as "submitted" if it got rejected', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(false);

      expect(playersManager.getIsSubmitted()).toBeFalsy();
    });

    test('should unmark the players as "proposed" if it got rejected', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(false);

      expect(playersManager.getProposedPlayers().length).toStrictEqual(0);
    });

    test('should automatically vote affirmatively in case it is the last round of voting', () => {
      _.times(4, () => {
        proposeAndSubmitTeam(['user-1', 'user-2']);

        voteAllForTeam(false);
      });

      proposeAndSubmitTeam(['user-1', 'user-2']);

      // the voting should be over and the
      // quest voting should have started
      expect(() => game.voteForTeam('user-1', false)).toThrow(errors.NO_VOTING_TIME);
    });
  });

  describe('quest voting', () => {
    test('should throw when attempting to vote for the quest if the team voting has failed', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      expect(() => game.voteForQuest('user-1', true)).toThrow(errors.NO_VOTING_TIME);

      voteAllForTeam(false);

      expect(() => game.voteForQuest('user-1', true)).toThrow(errors.NO_VOTING_TIME);
    });

    test('should not throw when attempting to vote for the quest if the team voting has succeeded', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(true);

      expect(() => game.voteForQuest('user-1', true)).not.toThrow(errors.NO_VOTING_TIME);
    });

    test('should throw when attempting to vote for the quest, after the quest voting has completed', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(true);

      voteAllForQuest(false);

      expect(() => game.voteForQuest('user-1', true)).toThrow(errors.NO_VOTING_TIME);
    });

    test('should return whether quest voting is on', () => {
      expect(game.questVotingIsOn()).toBeFalsy();

      proposeAndSubmitTeam(['user-1', 'user-2']);

      expect(game.questVotingIsOn()).toBeFalsy();

      voteAllForTeam(true);

      expect(game.questVotingIsOn()).toBeTruthy();
    });

    test('should only allow a proposed player to vote on a quest', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(true);

      expect(() => game.voteForQuest('user-1', true)).not.toThrow();
      expect(() => game.voteForQuest('user-4', true)).toThrow(errors.NO_RIGHT_TO_VOTE);
      expect(() => game.voteForQuest('nonexistent', true)).toThrow(errors.NO_RIGHT_TO_VOTE);
    });

    test('should only allow a player to vote on a quest once', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(true);

      game.voteForQuest('user-1', true);
      expect(() => game.voteForQuest('user-1', true)).toThrow(errors.NO_RIGHT_TO_VOTE);
    });

    test('should persist the vote in the quest history', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(true);

      jest.spyOn(questsManager, 'addVote');

      game.voteForQuest('user-1', true);

      expect(questsManager.addVote).toBeCalledTimes(1);
    });

    test('should reset the votes after every proposed player has voted', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      voteAllForTeam(true);

      voteAllForQuest(false);

      const playersWhoVotedCount = playersManager.getAll().filter(p => p.getVote()).length;

      expect(playersWhoVotedCount).toStrictEqual(0);
    });

    test('should move to the next quest, after the quest voting has failed', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      const previousQuest = questsManager.getCurrentQuest();

      voteAllForTeam(true);

      voteAllForQuest(false);

      expect(previousQuest).not.toBe(questsManager.getCurrentQuest());
    });

    test('should move to the next quest, after the quest voting has been successful', () => {
      proposeAndSubmitTeam(['user-1', 'user-2']);

      const previousQuest = questsManager.getCurrentQuest();

      voteAllForTeam(true);

      voteAllForQuest(false);

      expect(previousQuest).not.toBe(questsManager.getCurrentQuest());
    });
  });

  describe('assassination', () => {
    test('should return whether assassination is on', () => {
      jest.spyOn(questsManager, 'assassinationIsAllowed');

      const assassinationIsOn = game.assassinationIsOn();

      expect(questsManager.assassinationIsAllowed).toBeCalledTimes(1);
      expect(questsManager.assassinationIsAllowed()).toEqual(assassinationIsOn);
    });

    test('should throw if it is not an appropriate time for assassination', () => {
      const assassin = playersManager.getAssassin();

      expect(() => game.assassinate(assassin.getUsername(), 'user-2'))
        .toThrow(errors.NO_ASSASSINATION_TIME);

      passQuestsWithResults([true, true, true]);

      expect(() => game.assassinate(assassin.getUsername(), 'user-2'))
        .not
        .toThrow(errors.NO_ASSASSINATION_TIME);
    });

    test('should persist assassination results', () => {
      const assassin = playersManager.getAssassin();

      passQuestsWithResults([true, true, true]);

      jest.spyOn(playersManager, 'assassinate');
      jest.spyOn(questsManager, 'setAssassinationStatus');

      game.assassinate(assassin.getUsername(), 'user-1');

      expect(playersManager.assassinate).toBeCalledTimes(1);
      expect(questsManager.setAssassinationStatus).toBeCalledTimes(1);
    });

    test('should set the game status to "0", if the victim was Merlin', () => {
      const assassin = playersManager.getAssassin();
      const merlin   = playersManager.getAll()
        .find(p => p.getRole().getId() === roleIds.MERLIN);

      passQuestsWithResults([true, true, true]);

      game.assassinate(assassin.getUsername(), merlin.getUsername());

      expect(questsManager.getStatus()).toStrictEqual(0);
    });

    test('should set the game status to "1", if the victim was not Merlin', () => {
      const assassin  = playersManager.getAssassin();
      const nonMerlin = playersManager.getAll()
        .find(p => p.getRole().getId() !== roleIds.MERLIN);

      passQuestsWithResults([true, true, true]);

      game.assassinate(assassin.getUsername(), nonMerlin.getUsername());

      expect(questsManager.getStatus()).toStrictEqual(1);
    });
  });
});