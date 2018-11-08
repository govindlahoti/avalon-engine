const _ = require('lodash');

const GameState = function (obj) {
  this._data = Object.assign({}, _.cloneDeep(obj));

  this._omitUselessFields(this._data, (val) => {
    return _.isFunction(val) || val instanceof Promise;
  });
};

GameState.prototype._omitUselessFields = function (obj, iteratee) {
  _.each(obj, (v, k) => {
    _.unset(obj, k);

    if (iteratee(v, k)) return;

    obj[k.replace(/_/, '')] = v;

    if (_.isObject(v)) {
      this._omitUselessFields(v, iteratee);
    }
  });

  return obj;
};

GameState.prototype.get = function () {
  return this._data;
};

module.exports = GameState;