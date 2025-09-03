var roleWorker = require('role.worker');
var roleMiner = require('role.miner');
var makeCreep = require('make.creep');
var taskManager = require('task.manager');
var baseUtilities = require('base.utilities');

var baseArchitect = require('base.architect');
var baseManager = require('base.manager');
var roomCacheUtility = require('room.cache');
var hudOverlay = require('hud.overlay');

const WORKFORCE = { miner: 0, fastworker: 1, worker: 2, harvester: 0, upgrader: 0, builder: 0 };
const CONSTRUCTION = { container: 0, extension: 0 }

module.exports.loop = function () {

    baseUtilities.cleanUpCreepMemory();

    // Perform per-room actions
    for (const roomName in Game.rooms) {
        const thisRoom = Game.rooms[roomName];
        
        roomCacheUtility.init(thisRoom);
        baseArchitect.run(thisRoom);
        baseManager.run(thisRoom);
        hudOverlay.render(thisRoom);
        

        taskManager.prepare(thisRoom);
      
        // Manage base by level
        const roomControllerLevel = thisRoom.controller.level || 0;
        if (roomControllerLevel == 2) {
            WORKFORCE.worker = 3;
            WORKFORCE.fastworker = 2;
        }

        // Manage the base
        var roomController = thisRoom.controller;
        var MAX_CONSTRUCTION_SITES = 0;
        const activeConstructions = thisRoom.find(FIND_CONSTRUCTION_SITES).length;

        CONSTRUCTION.extension  = (CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][roomController.level] || 0);

        var containersBuilt = thisRoom.find(FIND_STRUCTURES, {filter: function(s){ return s.structureType === STRUCTURE_CONTAINER; }}).length;
        var containersQueued = thisRoom.find(FIND_CONSTRUCTION_SITES, {filter: function(s){ return s.structureType === STRUCTURE_CONTAINER; }}).length;
        var containerCount = containersBuilt + containersQueued;

        var extensionsBuilt = thisRoom.find(FIND_STRUCTURES, {filter: function(s){ return s.structureType === STRUCTURE_EXTENSION; }}).length;
        var extensionsQueued = thisRoom.find(FIND_CONSTRUCTION_SITES, {filter: function(s){ return s.structureType === STRUCTURE_EXTENSION; }}).length;
        var extensionCount = extensionsBuilt + extensionsQueued;


        if (roomControllerLevel == 2) {
        //    console.log('Room level 2');
            // The max number of containers that we want is one per energy source and one for the spawn
            var sourceCount = thisRoom.find(FIND_SOURCES).length;
            var containersAllowedThisLevel = (CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][roomController.level] || 0);
            var extensionsAllowedThisLevel = (CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][roomController.level] || 0);
            MAX_CONSTRUCTION_SITES = 1;
            
//            console.log('Room controller level: ' + roomController.level);
//            console.log('extensions allowed: ' + extensionsAllowedThisLevel);
            if (extensionCount < extensionsAllowedThisLevel) {
                CONSTRUCTION.container = 1
            } else {
//                console.log('setting containers to max');
//                CONSTRUCTION.container = Math.min(sourceCount +1, containersAllowedThisLevel);
                CONSTRUCTION.container = Math.min(sourceCount, containersAllowedThisLevel);
            }
        }
        
        if (containerCount == CONSTRUCTION.container && extensionCount == CONSTRUCTION.extension) {
            MAX_CONSTRUCTION_SITES = 0;
        }
        
        if (activeConstructions < MAX_CONSTRUCTION_SITES) {
//            console.log('Open construction site, finding something to build');
//            console.log('Containers:' + containerCount + '/' + CONSTRUCTION.container);
//            console.log('Extensions:' + extensionCount + '/' + CONSTRUCTION.extension);
            // Let's build something!
            var newConstruction = null;

            if (!newConstruction && containerCount < CONSTRUCTION.container) {
                newConstruction = baseUtilities.autoPlanContainers(thisRoom);
//                console.log('Started construction on container. Set newConstruction to: ' + newConstruction);
            }
            
            if (!newConstruction && extensionCount < CONSTRUCTION.extension) {
                baseUtilities.autoPlanExtensions(thisRoom);
//                console.log('Started construction on extension. Set newConstruction to: ' + newConstruction);
            }
        }
        
        // Manage the worker Counts
        WORKFORCE.miner = containerCount;
        if (WORKFORCE.miner > 2) {
            WORKFORCE.worker = 2;
        }
        const counts = _.countBy(_.filter(Game.creeps, c => c.room.name === thisRoom.name), c => c.memory.role);
        for (const role of Object.keys(WORKFORCE)) {
            const need = WORKFORCE[role];
            const have = counts[role] || 0;

            if (thisRoom.energyAvailable < 200) break;
            
            if (have < need) {
                //makeCreep.run(thisRoom, role);
                break;
            }
        }
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        
        switch(creep.memory.role) {
            case 'worker': roleWorker.run(creep); break;
            case 'fastworker': roleWorker.run(creep); break;
            case 'miner': roleMiner.run(creep); break;
            case 'harvester': roleHarvester.run(creep); break;
            case 'upgrader': roleUpgrader.run(creep); break;
            case 'builder': roleBuilder.run(creep); break;
        }
    }
    
    // ----- Console Commands ----- //
    // Use the peek() console command to look at the current task list
    if (!global.peek) {
      global.peek = function (role, roomName) {
        role = role || 'worker';
        var list = Object.values(Game.creeps).filter(function(c){
          return (!role || c.memory.role === role) && (!roomName || c.room.name === roomName);
        });
    
        list.forEach(function(c){
          var t = c.memory.task;
          var id = t && (t.id || t.target);
          var o  = id && Game.getObjectById(id);
          var msg;
    
          if (c.store.getFreeCapacity(RESOURCE_ENERGY) > 0) msg = 'refilling';
          else if (!t) msg = 'upgrade (fallback)';
          else if (!o) msg = t.type + ' -> (missing ' + id + ')';
          else if (t.type === 'fill') {
            var kind = o.structureType || (o.constructor && o.constructor.name) || 'obj';
            var free = 'n/a';
            if (o.store && typeof o.store.getFreeCapacity === 'function') {
              var v = o.store.getFreeCapacity(RESOURCE_ENERGY);
              free = (v === undefined || v === null) ? 'n/a' : v;
            }
            msg = 'fill -> ' + kind + ' free=' + free;
          } else if (t.type === 'build') {
            msg = 'build -> ' + o.structureType + ' ' + o.progress + '/' + o.progressTotal;
          } else if (t.type === 'upgrade') {
            msg = 'upgrade -> controller';
          } else {
            msg = t.type;
          }
    
          console.log('[' + c.room.name + '] ' + c.name + ': ' + msg);
        });
      };
    }
    
    if (!global.dropContainer) {
      global.dropContainer = function(roomName, sourceIndex) {
        var room = Game.rooms[roomName]; if (!room) return console.log('no room');
        var src = room.find(FIND_SOURCES)[sourceIndex||0]; if (!src) return console.log('no source');
        var terrain = room.getTerrain(), x=src.pos.x, y=src.pos.y, xx, yy, rc;
        for (var dx=-1; dx<=1; dx++) for (var dy=-1; dy<=1; dy++) {
          if (!dx && !dy) continue; xx=x+dx; yy=y+dy;
          if (xx<1||xx>48||yy<1||yy>48) continue;
          if (terrain.get(xx,yy)===TERRAIN_MASK_WALL) continue;
          if (room.lookForAt(LOOK_STRUCTURES,xx,yy).length) continue;
          if (room.lookForAt(LOOK_CONSTRUCTION_SITES,xx,yy).length) continue;
          rc = room.createConstructionSite(xx,yy,STRUCTURE_CONTAINER);
          console.log('container @',xx,yy,'->',rc); return rc;
        }
        console.log('no open adjacent tile');
      };
    }

}