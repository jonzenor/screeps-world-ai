/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.manager');
 * mod.thing == 'a thing'; // true
 */
var roomCacheUtility = require('room.cache');

var BODY_BOOK = {
    worker: { seed: [WORK, CARRY, MOVE], add: [WORK, WORK, CARRY, MOVE], max: 50, useRole: 'worker' },
    fastworker: { seed: [WORK, CARRY, MOVE], add: [MOVE, WORK, CARRY, MOVE], max: 50, useRole: 'worker' },
    miner: { seed: [WORK, CARRY, MOVE], add: [WORK], max: 7, useRole: 'miner'},
    rallyhauler: { seed: [CARRY, CARRY, MOVE], add: [MOVE, CARRY], max: 50, useRole: 'hauler' },
    roadhauler: { seed: [CARRY, CARRY, MOVE], add: [MOVE, CARRY, CARRY], max: 50, useRole: 'hauler' },
}

function partCost(part) { return BODYPART_COST[part]; }
function bodyCost(body) {
    var sumCost = 0;
    for (var i = 0; i < body.length; i++) {
        sumCost += partCost(body[i]);
    }
    
    return sumCost;
}

function buildBody(role, budget) {
    var spec = BODY_BOOK[role] || BODY_BOOK.worker;
    var body = spec.seed.slice();
    var i = 0;
    
    while (body.length < spec.max) {
        var next = spec.add[i % spec.add.length];
        if (bodyCost(body) + partCost(next) > budget) {
            break;
        }
        
        body.push(next);
        i++;
    }
    
    return body;
}

function cacheCreepCount(room, roomCache) {
    if (roomCache.tick != Game.time) {
        // Reset vars
        roomCache.tick = Game.time;
        roomCache.creepsCount = 0;
        roomCache.creepsByRole = {};
        
        // Recalculate count
        for (var n in Game.creeps) {
            var creep = Game.creeps[n];
            
            if (!creep.room || creep.room.name != room.name) { continue; }
            
            var role = (creep.memory && creep.memory.role) || 'unknown';
            roomCache.creepsByRole[role] = (roomCache.creepsByRole[role] || 0) + 1;
            roomCache.creepsCount = (roomCache.creepsCount || 0) + 1;
        }
    }
    
}

module.exports = {
    run(room) {
        // Load the architect codex for the roster roles required
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].architect || !Memory.rooms[room.name].architect.manning) {
            console.log('Manager: Sleeping until architect codex is ready');
            return;
        }
        
        var codex = Memory.rooms[room.name].architect;

        // Count each type of creep
        var roomCache = roomCacheUtility.getSection(room, 'creeps');
        cacheCreepCount(room, roomCache);
        
        // See if the spawner is spawning
        spawner = Game.getObjectById(codex.structures.mainSpawn.id);
        if (!spawner || spawner.spawning) {
            return;
        }
        
        // See if there is enough energy available
        var maxEnergy = room.energyCapacityAvailable;
        var energyAvailable = room.energyAvailable;
        
        if (energyAvailable < maxEnergy) {
            return;
        }
        
        // Get the list of manning requirements
        var manning = Memory.rooms[room.name].architect.manning;
        var roles = Object.keys(manning);
        roles.sort(function(a, b) {
            return manning[a].priority - manning[b].priority;
        });

        // Spawn a creep if required
        _.forEach(roles, function(roleName) {
           var needed = manning[roleName].count || 0;
           var have = (roomCache.creepsByRole && roomCache.creepsByRole[roleName]) || 0;
           
           if (have < needed) {
                
                var roleBody = buildBody(roleName, maxEnergy);
                var name = roleName + '-' + Game.time;
               
                var spawnResult = spawner.spawnCreep(roleBody, name, { memory: { role: roleName, roleType: BODY_BOOK[roleName].useRole } });
                console.log('MANAGER: Requesting Spawn: ' + maxEnergy + ':' + roleName + ' Status: ' + spawnResult);
                return false;
            }
        });
    }
};