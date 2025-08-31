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
  // reuse last target
  //let harvestObject = creep.memory.energySource && Game.getObjectById(creep.memory.energySource);
  var harvestObject = Game.getObjectById(creep.memory.energySource);

    var isContainer = harvestObject && harvestObject.structureType === STRUCTURE_CONTAINER;
    var isDropped   = harvestObject && harvestObject.resourceType === RESOURCE_ENERGY;
    var isSource    = harvestObject &&
                      ('energy' in harvestObject) &&
                      ('ticksToRegeneration' in harvestObject) &&
                      !('structureType' in harvestObject) &&
                      !('resourceType' in harvestObject);
    var harvestResult = null;
  
  if (!harvestObject) {
    harvestObject = findHarvestSource(creep);

    creep.memory.energySource = harvestObject ? harvestObject.id : null;
    return;
  }

  if (isContainer)      harvestResult = creep.withdraw(harvestObject, RESOURCE_ENERGY);
  else if (isDropped)   harvestResult = creep.pickup(harvestObject);
  else if (isSource)    harvestResult = creep.harvest(harvestObject);
  else { creep.memory.energySource = null; return; }

  if (harvestResult === ERR_NOT_IN_RANGE) {
    creep.moveTo(harvestObject, { reusePath: 3, visualizePathStyle: { stroke: '#ffff00' } });
  }

  // optional quick retarget if drained
  if ((isContainer && harvestObject.store[RESOURCE_ENERGY] === 0) ||
      (isSource && harvestObject.energy === 0) ||
      (isDropped && harvestObject.amount === 0)) {
    var src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    creep.memory.energySource = src ? src.id : null;
  }
  
  if (harvestResult == OK) {
      // Reset the source after harvesting so we can attempt to find a more efficient energy source
      creep.memory.energySource = null;
  }
};

function findHarvestSource(creep) {
    var capacity = Math.min(creep.store.getCapacity(RESOURCE_ENERGY), 150);

    newDrop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: function(r){ return r.resourceType === RESOURCE_ENERGY && r.amount >= 100; }
    });
    if (newDrop) return newDrop;
    
    var newContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function(s){ return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] >= capacity; }
    });
    if (newContainer) return newContainer;

    newSource = creep.pos.findClosestByPath(FIND_SOURCES);
    if (newSource) return newSource; 
    
    return null;
}

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