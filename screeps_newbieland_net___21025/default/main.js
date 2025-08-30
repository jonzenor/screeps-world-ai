var roleBuilder = require('role.builder');
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleWorker = require('role.worker');
var makeCreep = require('make.creep');
var taskManager = require('task.manager');
var baseUtilities = require('base.utilities');

const WORKFORCE = { fastworker: 1, worker: 2, harvester: 0, upgrader: 0, builder: 0};
const CONSTRUCTION = { container: 0, extension: 0 }

module.exports.loop = function () {
    
    baseUtilities.cleanUpCreepMemory();

    // Perform per-room actions
    for (const roomName in Game.rooms) {
        const thisRoom = Game.rooms[roomName];
        
        taskManager.prepare(thisRoom);
      
        // Manage base by level
        const roomControllerLevel = thisRoom.controller.level || 0;
        if (roomControllerLevel == 2) {
            WORKFORCE.worker = 3;
            WORKFORCE.fastworker = 2;
        }

        // Manage the worker Counts
        const counts = _.countBy(_.filter(Game.creeps, c => c.room.name === thisRoom.name), c => c.memory.role);
        for (const role of Object.keys(WORKFORCE)) {
            const need = WORKFORCE[role];
            const have = counts[role] || 0;

            if (thisRoom.energyAvailable < 200) break;
            
            if (have < need) {
                makeCreep.run(thisRoom, role);
                break;
            }
        }

        // Manage the base
        var roomController = thisRoom.controller && thisRoom.controller.level || 0;
        const MAX_CONSTRUCTION_SITES = 1;
        const activeConstructions = thisRoom.find(FIND_CONSTRUCTION_SITES).length;

        CONSTRUCTION.extension  = (CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][roomController.level] || 0);

        if (roomControllerLevel == 2) {
            // The max number of containers that we want is one per energy source and one for the spawn
            var sourceCount = thisRoom.find(FIND_SOURCES).length;
            var maxAllowedThisLevel = (CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][roomController.level] || 0);
            CONSTRUCTION.container = Math.min(sourceCount +1, maxAllowedThisLevel);
        }
        
        if (activeConstructions < MAX_CONSTRUCTION_SITES) {
            console.log('Open construction site, finding something to build');
            // Let's build something!
            var newConstruction = baseUtilities.autoPlanContainers(thisRoom);
            
            if (!newConstruction) baseUtilities.autoPlanExtensions(thisRoom);
        }

        // Set the GUI Overlay for the room    
        const vis = new RoomVisual(thisRoom.name);

        // ----- Display Worker Counts ----- //        
        vis.rect(1, 10, 8.5, (Object.keys(WORKFORCE).length + 1.1), {fill: '#000', opacity: 0.3, stroke: '#fff'});
        vis.text(`Workers`, 1.2, 11, {align: 'left', font: 0.9});
        
        let y = 12;
        const xL = 1.2;      // left column
        const xR = 9.0;      // right column edge

        for (const role of Object.keys(WORKFORCE)) {
            const have = counts[role] || 0;
            const need = WORKFORCE[role] || 0;
        
            vis.text(role, xL, y, { align: 'left',  font: '0.7 monospace' });
            vis.text(`${have} / ${need}`, xR, y, { align: 'right', font: '0.7 monospace' });
        
            y += 0.9;
        }

        // Add Overlay to spawner
        var roomSpawns = thisRoom.find(FIND_MY_SPAWNS)
        for (var i = 0; i < roomSpawns.length; i++) {
            var thisSpawn = roomSpawns[i];
            if (!thisSpawn.spawning) continue;
            
            var spawning = thisSpawn.spawning;
            var timeNeeded = spawning.needTime | 0;
            var timeRemaining = spawning.remainingTime | 0;
            var spawnPercent = timeNeeded ? Math.floor((timeNeeded - timeRemaining) * 100 / timeNeeded) : 0;
            var spawnName = spawning.name;
            var spawnRole = (Memory.creeps[spawnName] && Memory.creeps[spawnName].role) || 'creep';

            thisSpawn.room.visual.text(
                '🛠' + spawnRole + ' ' + spawnPercent + '%',
                thisSpawn.pos.x + 1, thisSpawn.pos.y - 0.25,
                { align: 'left', opacity: 0.8, font: 0.8 }
            );
        }
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        
        switch(creep.memory.role) {
            case 'worker': roleWorker.run(creep); break;
            case 'fastworker': roleWorker.run(creep); break;
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