/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.manager');
 * mod.thing == 'a thing'; // true
 */
var roomCacheUtility = require('room.cache');

module.exports = {
    run(room) {
        // Load the architect codex for the roster roles required
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].architect || !Memory.rooms[room.name].architect.manning) {
            console.log('Manager: Sleeping until architect codex is ready');
            return;
        }
        
        var codex = Memory.rooms[room.name].architect;
        
        // See if the spawner is spawning
        spawner = Game.getObjectById(codex.structures.mainSpawn.id);
        
        // Count each type of creep
        var roomCache = roomCacheUtility.get(room);
        if (!roomCache.creepsCount || roomCache.tick != Game.time) {
            // Recalculate count
            for (var n in Game.creeps) {
                var creep = Game.creeps[n];
                
                if (!creep.room || creep.room.name != room.name) {
                    continue;
                }
                
                var role = (creep.memory && creep.memory.role) || 'unknown';
                roomCache.creepsByRole[role] = (roomCache.creepsByRole[role] || 0) + 1;
                roomCache.creepsCount = (roomCache.creepsCount || 0) + 1;
            }
        }
        
        // Get the list of manning requirements
        var manning = Memory.rooms[room.name].architect.manning;
        
        // Spawn a creep if required
    }
};