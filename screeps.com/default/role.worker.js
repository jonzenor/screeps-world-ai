/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.worker');
 * mod.thing == 'a thing'; // true
 */
 var taskManager = require('task.manager');

function harvestNearest(creep) {
    // Reuse the last source if it's still exists and is active
    let useSource = creep.memory.energySource && Game.getObjectById(creep.memory.energySource);
    
    if (!useSource || useSource.energy === 0) {
        useSource = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        creep.memory.energySource = useSource && useSource.id;
    }
    
    if (!useSource) return; // Nothing to harvest
    const harvestResult = creep.harvest(useSource);
    
    if (harvestResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(useSource, {reusePath: 3, visualizePathStyle: {stroke: '#ffffff'}});
    } else if (harvestResult === ERR_INVALID_TARGET) {
        creep.memory.energySource = null;
    }
};

function executeTask(creep) {
    const task = creep.memory.task;
    const target = Game.getObjectById(task.target);
    //console.log(creep.name + ' executing task "' + task.type + '" on target at location '  + target.pos?.x + ', ' + target.pos?.y );
    
    if (task.type == 'build') {
        const buildResult = creep.build(target);
        
        if (buildResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 3, visualizePathStyle: {stroke: '#ffbf00'}});
        }
    }
    
    if (task.type == 'fill') {
        const fillResult = creep.transfer(target, RESOURCE_ENERGY);
        
        if (fillResult == ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 3, visualizePathStyle: {stroke: '#add8e6'}});
        }
        
        if (fillResult == OK && (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) {
            creep.memory.task = null;
        }
    }
    
    if (task.type == 'upgrade') {
        const upgradeResult = creep.upgradeController(target);
        
        if (upgradeResult == ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 3, visualizePathStyle: {stroke: '#ffc0cb'}});
        }
    }
}

module.exports = {
    run(creep) {
        if (creep.spawning) return;
        
        // Prioritize harvesting energy
        if (creep.memory.refilling || creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.refilling = true;
            creep.memory.task = null;
            harvestNearest(creep);
    
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.refilling = false;
            }
    
            return;
        }
        
        // Check that the current task is valid
        if (creep.memory.task && taskManager.isValid(creep.room, creep.memory.task)) {
            executeTask(creep);
            return;
        }
        
        // Get a new task
        const task = taskManager.claim(creep);
        if (task) {
            creep.memory.task = task;
            executeTask(creep);
        } else {
            // Fallback Option
            console.log('Nothing to Do');
        }
    },
};