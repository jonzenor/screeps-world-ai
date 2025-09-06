/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.worker');
 * mod.thing == 'a thing'; // true
 */
 var taskManager = require('task.manager');
 var roomCacheUtility = require('room.cache');

function harvestNearest(creep, sourceQueue) {
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
    harvestObject = findHarvestSource(creep, sourceQueue);

    creep.memory.energySource = harvestObject ? harvestObject.id : null;
    return;
  }

  if (isContainer)      harvestResult = creep.withdraw(harvestObject, RESOURCE_ENERGY);
  else if (isDropped)   harvestResult = creep.pickup(harvestObject);
  else if (isSource)    harvestResult = creep.harvest(harvestObject);
  else { creep.memory.energySource = null; return; }
  
  if (harvestResult === OK && isSource) {
      checkInAtSource(creep.memory.energySource, creep, sourceQueue);
  }

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

function findHarvestSource(creep, sourceQueue) {
    var capacity = Math.min(creep.store.getCapacity(RESOURCE_ENERGY), 150);

    newDrop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: function(r){ return r.resourceType === RESOURCE_ENERGY && r.amount >= 100; }
    });
    if (newDrop) return newDrop;
    
    var newContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function(s){ return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] >= capacity; }
    });
    if (newContainer) return newContainer;

    // Get closest source first
    // newSource = creep.pos.findClosestByPath(FIND_SOURCES);
    
    var roomSources = creep.room.find(FIND_SOURCES_ACTIVE);
    roomSources.sort(function(a, b) {
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });
    
    var usingSource = null;
    
    _.forEach(roomSources, function(source) {
        if (!source.energy) {
            // Not a natural source
            usingSource - source;
            return false;
        }
        
        if (queueUpSource(source, creep, sourceQueue)) {
            usingSource = source;
            return false; // This exits the forEach loop
        }
    });
    return usingSource; 
}

function checkInAtSource(source, creep, sourceQueue) {
    if (Memory.debug['worker']) {
        console.log('sourceQueue @ checkInAtSource: ' + JSON.stringify(sourceQueue));
    }
    
    var sourceId = (typeof source === 'string') ? source : (source && source.id);
    
    if (!sourceQueue[sourceId]) {
        sourceQueue = constructSourceQueue(sourceQueue, creep, sourceId);
    }
    // console.log('NEW sourceQueue: ' + JSON.stringify(sourceQueue));
    var sourceCache = sourceQueue[sourceId];
    
    if (sourceCache.enroute && sourceCache.enroute.indexOf(creep.name) >= 0) {
        var index = sourceCache.enroute.indexOf(creep.name);
        if (index !== -1) {
            sourceCache.enroute.splice(index, 1);
        }
        
        if (sourceCache.at.indexOf(creep.name) === -1) {
            sourceCache.at.push(creep.name);
        }
    }
}

function checkOutAtSource(source, creep, sourceQueue) {
    
    if (Memory.debug['worker']) {
        console.log('sourceQueue @ checkOutAtSource: ' + JSON.stringify(sourceQueue));
    }
    
    var sourceId = (typeof source === 'string') ? source : source.id

    if (!sourceQueue[sourceId]) {
        sourceQueue = constructSourceQueue(sourceQueue, creep, sourceId);
    }
    
    var sourceCache = sourceQueue[sourceId];
    if (sourceCache.at[creep.name]) {
        var index = sourceCache.at.indexOf(creep.name);
        if (index !== -1) {
            sourceCache.at.splice(index, 1);
        }
    }
}

function queueUpSource(source, creep, sourceQueue) {
    if (Memory.debug['worker']) {
        console.log('sourceQueue @ queueUpSource for source: ' + source + ' :' + JSON.stringify('sourceQueue'));
    }

    if (!sourceQueue[source.id]) {
        sourceQueue = constructSourceQueue(sourceQueue, creep, source);
    }
    
    var sourceCache = sourceQueue[source.id];
    if (sourceCache.enroute.length < (sourceCache.available * 1.0)) {
        
        if (!sourceCache.enroute[creep.name]) {
            sourceCache.enroute.push(creep.name);
        }
        
        if (Memory.debug['worker']) {
            console.log('WORKER: queued up at a source');
            console.log('sourceQueue @ queueUpSource - true: ' + JSON.stringify(sourceQueue));
        }
        return true;
    } else {
        // console.log('WORKER: Failed to queue up at a source: ' + source.id);
        return false;
    }
}

function constructSourceQueue(sourceQueue, creep, source) {
    if (Memory.debug['worker']) {
        console.log('Reconstructing sourceQueue for source ' + source);
    }
    
    var sourceId = (typeof source === 'string') ? source : source.id
    var sourceCodex = Memory.rooms[creep.room.name].architect.sources[sourceId];
    
    if (Memory.debug['worker']) {
        console.log('Found source: ' + JSON.stringify(sourceCodex));
    }
    
    var freeSites = sourceCodex.freeSpaces;

    if (sourceCodex.containerStatus !== 'planned') {
        freeSites --;
    }
    
    sourceQueue[sourceId] = {
        available: freeSites,
        enroute: [],
        at: [],
    }
    
    if (Memory.debug['worker']) {
        console.log('sourceQueue @ constructSourceQueue - return: ' + JSON.stringify(sourceQueue));
    }
    return sourceQueue;
}

function hasOpenHarvestSpot(src) {
  var terrain = Game.map.getRoomTerrain(src.room.name), x=src.pos.x, y=src.pos.y, dx, dy;
  
  for (dx = -1; dx <= 1; dx ++) {
        for (dy=-1; dy<=1; dy++) {
            if (!dx && !dy) continue;
            
            if (terrain.get(x + dx, y + dy) !== TERRAIN_MASK_WALL &&
                src.room.lookForAt(LOOK_CREEPS, x + dx, y + dy).length === 0) return true;
        }
    }
  
    return false;
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
        var sourceQueue = roomCacheUtility.getSection(creep.room, 'sourceQueue');
        if (Memory.debug['worker']) {
            console.log('sourceQueue @ run: ' + JSON.stringify(sourceQueue));
        }
        
        // Prioritize harvesting energy
        if (creep.memory.refilling || creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.refilling = true;
            creep.memory.task = null;
            harvestNearest(creep, sourceQueue);
    
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.refilling = false;
                
                var harvestObject = Game.getObjectById(creep.memory.energySource);
                if (harvestObject && harvestObject.energy) {
                    checkOutAtSource(creep.memory.energySource, creep, sourceQueue);
                }
                creep.memory.energySource = null;
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