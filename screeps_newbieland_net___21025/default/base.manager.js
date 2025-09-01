/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.manager');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    run(room) {
        // Load the architect codex for the roster roles required
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].architect || Memory.rooms[room.name].architect.manning) {
            console.log('Manager sleeping until architect codex is ready');
            return;
        }
        
        // See if the spawner is spawning
        
        // Count each type of creep
        
        // Get the list of manning requirements
        var manning = Memory.rooms[room.name].architect.manning;
        
        // Spawn a creep if required
    }
};