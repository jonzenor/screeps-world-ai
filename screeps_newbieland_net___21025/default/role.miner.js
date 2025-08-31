/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.miner');
 * mod.thing == 'a thing'; // true
 */
 var baseUtilities = require('base.utilities');

function findEnergySourceContainer(creep) {
    // Find all sources
    var containers = creep.room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER});
    roomMemory = Memory.rooms[creep.room.name];
    
    for (var i = 0; i < containers.length; i++) {
        var thisContainer = containers[i];
        
        
    }
    
    var sources = creep.room.find(FIND_SOURCES);
    
    for (var i = 0; i < sources.length; i++) {
        var thisSource = sources[i];
        
        if (baseUtilities.hasContainerNearSource(creep.room, thisSource)) {
            // See if this container is available
            var available = baseUtilities.containerAvailableForMiner(creep.room, this)
        }
        
        
    }
    
    // See if the container has an assigned miner yet
    
    // Fall back to nearest source
}

module.exports = {
    run(creep) {
        findEnergySourceContainer(creep);
    }
};