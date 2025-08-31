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
    var room = creep.room;
    
    // Find all sources
    var roomMemory = Memory.rooms[room.name];
    var claims = roomMemory.container || (roomMemory.container = {});
    
    var containers = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER});
    for (var i = 0; i < containers.length; i++) {
        var thisContainer = containers[i];
        
        var minerName = claims[thisContainer.id];
        if (!minerName || !Game.creeps[minerName]) {
            claims[thisContainer.id] = creep.name;
            creep.memory.assignedContainer = thisContainer.id;
            return thisContainer;
        }
    }
    
    var containerConstruction = room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_CONTAINER});
    for (var i = 0; i < containerConstruction.length; i++) {
        var thisContainer = containerConstruction[i];
        
        var minerName = claims[thisContainer.id];
        if (!minerName || !Game.creeps[minerName]) {
            claims[thisContainer.id] = creep.name;
            creep.memory.assignedContainer = thisContainer.id;
            return thisContainer;
        }
    }
    
    
    return null;
}

function hasValidContainer(creep) {
    var containerId = creep.memory.assignedContainer;
    if (!containerId) return false;
    
    var objectExists = Game.getObjectById(containerId);
    if (!objectExists || objectExists.structureType !== STRUCTURE_CONTAINER) {
        var roomMemory = Memory.rooms[creep.room.name];
        
        delete creep.memory.assignedContainer;
        delete roomMemory.container[containerId];
        return false;
    }
    return true;
}

function moveToContainer(creep, container) {
    if (!container) return ERR_INVALID_TARGET;
    
    if (creep.pos.isEqualTo(container.pos)) return OK;
    
    return creep.moveTo(container.pos, {reusePath: 5, visualizePathStyle: {stroke: '#ffffff'}});
}

module.exports = {
    run(creep) {
        var ownedContainer = null;
        if (hasValidContainer(creep)) {
            ownedContainer = Game.getObjectById(creep.memory.assignedContainer);
        } else {
            ownedContainer = findEnergySourceContainer(creep);
        }
        
        moveToContainer(creep, ownedContainer);
    }
};