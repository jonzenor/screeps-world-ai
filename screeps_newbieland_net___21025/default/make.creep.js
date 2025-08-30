// --- helpers ---
function bodyCost(body) {
  var sum = 0;
  for (var i = 0; i < body.length; i++) sum += BODYPART_COST[body[i]];
  return sum;
}

function bodyFor(role, room) {
  var cap = room.energyCapacityAvailable; // choose ideal by capacity
  switch (role) {
    case 'worker':        // generic early-game worker
      if (cap >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]; // 550
      return [WORK, WORK, CARRY, MOVE];                                          // 300

    case 'fastworker':    // a bit more MOVE for long walks
      if (cap >= 550) return [WORK, WORK, CARRY, MOVE, MOVE, MOVE];              // 500
      return [WORK, CARRY, MOVE, MOVE];                                           // 250

    case 'miner':         // parks on source
      if (cap >= 550) return [WORK, WORK, WORK, WORK, WORK, MOVE];               // 550
      return [WORK, WORK, MOVE];                                                 // 250

    case 'hauler':        // ferry between containers/structures
      if (cap >= 550) return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]; // 450
      return [CARRY, CARRY, MOVE];                                               // 150

    case 'upgrader':
      if (cap >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]; // 550
      return [WORK, WORK, CARRY, MOVE];                                          // 300

    case 'builder':
      if (cap >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]; // 550
      return [WORK, WORK, CARRY, MOVE];                                          // 300

    default:
      return [WORK, CARRY, MOVE];                                               // safe default
  }
}

// --- spawner ---
var makeCreep = {
  run: function (myRoom, creepRole) {
    var spawn = myRoom.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return ERR_NOT_FOUND;
    if (spawn.spawning) return ERR_BUSY;

    var body = bodyFor(creepRole, myRoom);
    var cost = bodyCost(body);

    // bail if not enough energy right now
    if (myRoom.energyAvailable < cost) return ERR_NOT_ENOUGH_ENERGY;

    var name = creepRole + '-' + Game.time;
    var rc = spawn.spawnCreep(body, name, { memory: { role: creepRole } });
    if (rc !== OK) console.log('spawnCreep failed:', rc);
    return rc;
  }
};

module.exports = makeCreep;
