var roleBuilder = require('role.builder');
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleWorker = require('role.worker');
var makeCreep = require('make.creep');
var taskManager = require('task.manager');
var baseUtilities = require('base.utilities');

const WORKFORCE = { fastworker: 1, worker: 2, harvester: 0, upgrader: 0, builder: 0};

module.exports.loop = function () {
    
    // Clean up the memory of deceased creeps
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    // Count the current creeps
    for (const roomName in Game.rooms) {
        const myRoom = Game.rooms[roomName];
      
        taskManager.prepare(myRoom);
      
        const counts = _.countBy(_.filter(Game.creeps, c => c.room.name === myRoom.name), c => c.memory.role);
        const rcl = myRoom.controller.level || 0;
        if (rcl >= 2) {
            WORKFORCE.worker = 3;
            WORKFORCE.fastworker = 2;
        }


        // Manage the workers
        for (const role of Object.keys(WORKFORCE)) {
            const need = WORKFORCE[role];
            const have = counts[role] || 0;

            if (myRoom.energyAvailable < 200) break; // cost of [W,C,M]
            
            if (have < need) {
                makeCreep.run(myRoom, role);
                break;
            }
        }
    
        const vis = new RoomVisual(myRoom.name);
        
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
        
        // Manage the base
        const MAX_ACTIVE_EXT_SITES = 1;
        const active = myRoom.find(FIND_CONSTRUCTION_SITES, {filter:s=>s.structureType===STRUCTURE_EXTENSION}).length;
        if (active < MAX_ACTIVE_EXT_SITES) baseUtilities.autoPlanExtensions(myRoom); // place at most one

    }

    if(Game.spawns['Spawn1'].spawning) {
        var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
        Game.spawns['Spawn1'].room.visual.text(
            '🛠️' + spawningCreep.memory.role,
            Game.spawns['Spawn1'].pos.x + 1,
            Game.spawns['Spawn1'].pos.y,
            {align: 'left', opacity: 0.8});
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


}