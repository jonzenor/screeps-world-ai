var roleBuilder = require('role.builder');
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleWorker = require('role.worker');
var makeCreep = require('make.creep');
var taskManager = require('task.manager');

const WORKFORCE = { worker: 8, harvester: 0, upgrader: 0, builder: 0};

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
        
        vis.rect(1, 10, 8.5, 5, {fill: '#000', opacity: 0.3, stroke: '#fff'});
        vis.text(`Workers`, 1.2, 11, {align: 'left', font: 0.9});
        
        let y = 12;
        const xL = 1.2;      // left column
        const xR = 9.0;      // right column edge

        for (const role of ['worker','harvester','upgrader','builder']) {
            const have = counts[role] || 0;
            const need = WORKFORCE[role] || 0;
        
            vis.text(role, xL, y, { align: 'left',  font: '0.7 monospace' });
            vis.text(`${have} / ${need}`, xR, y, { align: 'right', font: '0.7 monospace' });
        
            y += 0.9;
        }
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
            case 'harvester': roleHarvester.run(creep); break;
            case 'upgrader': roleUpgrader.run(creep); break;
            case 'builder': roleBuilder.run(creep); break;
        }
    }
    
    if (!global.peek) {
        global.peek = function (role = 'worker', roomName = null) {
            const list = Object.values(Game.creeps).filter(c =>
                (!role || c.memory.role === role) && (!roomName || c.room.name === roomName)
            );
            
            list.forEach(c => {
              const t = c.memory.task, o = t && Game.getObjectById(t.target);
              let msg =
                c.store.getFreeCapacity() > 0 ? 'refilling' :
                !t ? 'upgrade (fallback)' :
                !o ? `${t.type} -> (missing ${t.target})` :
                t.type === 'fill'  ? `fill -> ${o.structureType||o.constructor?.name} free=${o.store?.getFreeCapacity?.(RESOURCE_ENERGY) ?? 'n/a'}` :
                t.type === 'build' ? `build -> ${o.structureType} ${o.progress}/${o.progressTotal}` :
                t.type === 'upgrade' ? 'upgrade -> controller' :
                t.type;
              console.log(`[${c.room.name}] ${c.name}: ${msg}`);
            });
        };
    }

}