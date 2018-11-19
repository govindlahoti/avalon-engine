import { Vote } from './vote';
import * as fromErrors from './errors';

export class Quest {
  private _votesNeeded: number;
  private _failsNeeded: number;
  private _totalPlayers: number;
  private _teamVoteRounds: Vote[][]     = [[], [], [], [], []];
  private _teamVotingRoundIndex: number = 0;
  private _questVotes: Vote[]           = [];

  // TODO: refactor type
  constructor(config: {
    votesNeeded: number,
    failsNeeded: number,
    totalPlayers: number
  }) {
    this._votesNeeded  = config.votesNeeded;
    this._failsNeeded  = config.failsNeeded;
    this._totalPlayers = config.totalPlayers;
  }

  getVotesNeeded() {
    return this._votesNeeded;
  }

  getFailsNeeded() {
    return this._failsNeeded;
  }

  // a.k.a "vote tracker"
  getTeamVotingRoundIndex() {
    return this._teamVotingRoundIndex;
  }

  questVotingFinished() {
    return this._questVotes.length === this._votesNeeded;
  }

  isComplete() {
    return this.getStatus() !== -1;
  }

  getStatus() {
    if (this.teamVotingAllowed() || this.questVotingAllowed()) {
      return -1;
    }

    return this._questVotingFailed() ? 1 : 0;
  }

  _questVotingFailed() {
    return this._failsCount() < this._failsNeeded;
  }

  _failsCount() {
    return this._questVotes.reduce(
      (acc, vote) => vote.getValue() ? acc : acc + 1, 0,
    );
  }

  addVote(vote: Vote) {
    this.teamVotingAllowed()
      ? this._addVoteForTeam(vote)
      : this._addVoteForQuest(vote);
  }

  _addVoteForTeam(vote: Vote) {
    const currentRound = this._getCurrentTeamVotingRound();

    // TODO: voting validation is also handled by the players manager
    if (this._alreadyVotedFor(currentRound, vote)) {
      throw new fromErrors.AlreadyVotedForTeamError();
    }

    currentRound.push(vote);

    if (this._everybodyVotedFor(currentRound) && !this.teamVotingSucceeded()) {
      this._teamVotingRoundIndex++;
    }
  }

  _addVoteForQuest(vote: Vote) {
    // TODO: voting validation is also handled by the players manager
    if (this._alreadyVotedFor(this._questVotes, vote)) {
      throw new fromErrors.AlreadyVotedForQuestError();
    }

    this._questVotes.push(vote);
  }

  _alreadyVotedFor(votes: Vote[], vote: Vote) {
    return !!votes.find((v: Vote) => v.getUsername() === vote.getUsername());
  }

  questVotingAllowed() {
    return this.teamVotingSucceeded()
      && this._questVotes.length < this._votesNeeded;
  }

  teamVotingSucceeded() {
    return !this.teamVotingAllowed() && this._majorityApproved();
  }

  _majorityApproved() {
    const currentRound = this._getCurrentTeamVotingRound();

    const failsCount = currentRound.reduce(
      (acc, vote) => vote.getValue() ? acc : acc + 1, 0,
    );

    return failsCount < Math.ceil(currentRound.length / 2);
  }

  teamVotingAllowed() {
    return this._getCurrentTeamVotingRound().length < this._totalPlayers
      || !this._majorityApproved();
  }

  teamVotingRoundFinished() {
    if (this.teamVotingSucceeded()) return true;

    const previousRound = this._getPreviousTeamVotingRound();

    if (!previousRound) return false;

    return this._everybodyVotedFor(previousRound)
      && this._getCurrentTeamVotingRound().length === 0;
  }

  _getPreviousTeamVotingRound() {
    return this._teamVoteRounds[this._teamVotingRoundIndex - 1];
  }

  _everybodyVotedFor(round: Vote[]) {
    return round.length === this._totalPlayers;
  }

  _getCurrentTeamVotingRound() {
    return this._teamVoteRounds[this._teamVotingRoundIndex];
  }

  isLastRoundOfTeamVoting() {
    return this._teamVotingRoundIndex === this._teamVoteRounds.length - 1;
  }

  serialize() {
    return {
      failsNeeded: this._failsNeeded,
      votesNeeded: this._votesNeeded,
      teamVotes: this._getCurrentTeamVotingRound().map(vote => vote.serialize()),
      questVotes: this._questVotes.map(vote => vote.serialize()),
    };
  }
}