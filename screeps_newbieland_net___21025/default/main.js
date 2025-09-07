var roleWorker = require('role.worker');
var roleMiner = require('role.miner');
var taskManager = require('task.manager');
var baseUtilities = require('base.utilities');

var baseArchitect = require('base.architect');
var baseManager = require('base.manager');
var roomCacheUtility = require('room.cache');
var hudOverlay = require('hud.overlay');
var baseTower = require('base.tower');

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
        
        var towers = thisRoom.find(FIND_MY_STRUCTURES, { filter: {structureType: STRUCTURE_TOWER}});
        for (var i in towers) {
            var tower = towers[i];
            
            baseTower.run(tower);
        }
      
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
        
        if (containerCount == CONSTRUCTION.container && extensionCount == CONSTRUCTION.extension) {
            MAX_CONSTRUCTION_SITES = 0;
        }
        
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        
        switch(creep.memory.roleType) {
            case 'worker': roleWorker.run(creep); break;
            case 'miner': roleMiner.run(creep); break;
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
    
    global.toggleDebug = function(key) {
        if (!Memory.debug) Memory.debug = {};
        if (!Memory.debug[key]) { Memory.debug[key] = false; }
        Memory.debug[key] = !Memory.debug[key];
        console.log('Debug for ' + key + ' is now ' + Memory.debug[key]);
        return Memory.debug[key];
    }
    
    global.dumpQueues = function(roomName) {
      if (global.__cache && global.__cache.rooms[roomName]) {
        global.__cache.rooms[roomName].sourceQueue = {};
        console.log('Cleared queue for', roomName);
      }
    };

}