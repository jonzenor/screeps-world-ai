/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('task.manager');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    prepare(room) {
        // Do this once per tick
        if (room.memory.tm && room.memory.tm.tick === Game.time) return room.memory.tm;
        
        const tasks = [];
        
        // Auto add the baseline priorities
        // The first priority is to recharge structures
        const fillers = room.find(FIND_STRUCTURES, {
            filter: s => (
                s.structureType === STRUCTURE_SPAWN || 
                s.structureType === STRUCTURE_EXTENSION ||
                s.structureType === STRUCTURE_TOWER
            ) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        for (const s of fillers) { 
            var usePriority = 5;
            var useSlots = 1;
            if (s.structureType == STRUCTURE_TOWER) {
                usePriority = 1;
                useSlots = 2;
            }
            tasks.push({ key: `fill:${s.id}`, type: `fill`, target: s.id, slots: useSlots, priority: usePriority});
        }
        
        // Defien construction sites
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        for (const b of sites) tasks.push({ key: `build:${b.id}`, type: `build`, target: b.id, slots: (b.type === STRUCTURE_CONTAINER) ? 1 : 2, priority: 5});
        
        // Upgrade the controller in this room if it's mine
        if (room.controller && room.controller.my) {
            tasks.push({
                key: `upgrade:${room.controller.id}`,
                type: 'upgrade',
                target: room.controller.id,
                slots: 25,
                priority: 7
            });
        }
        
        const claims = {};
        
        // Pre-claim tasks that are already held by creeps this tick
        for (const c of room.find(FIND_MY_CREEPS)) {
            const task = c.memory.task;
            if (!task || !task.type || !task.target) continue;
            
            const def = tasks.find(x => x.key === (task.key || `${task.type}:${task.target}`));
            if (!def) continue;
            
            const obj = Game.getObjectById(task.target);
            const stillValid = this.isValid(c.room, task);
            
            if (stillValid) claims[def.key] = (claims[def.key] || 0) +1;
        }
        
        room.memory.tm = { tick: Game.time, tasks, claims };
        
        // console.log(`[${room.name}] tick ${Game.time} | fillers=${fillers.length} | sites=${sites.length} | energy ${room.energyAvailable}/${room.energyCapacityAvailable}`);

        return room.memory.tm;
    },
    
    claim(creep) {
        
        const tm = creep.room.memory.tm;
        
        if (!tm) return null;
        var tasks = _.sortBy(tm.tasks, 'priority');
        
        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            
            // See if this task has been taken yet
            const taken = tm.claims[task.key] || 0;
            
            // Assign this task to the creep if it has a task slot available
            if (taken < (task.slots || 1) && this.isValid(creep.room, task)) {
                tm.claims[task.key] = taken + 1;
                return { key: task.key, type: task.type, target: task.target };
            }
        }
      
        return null;  
    },
    
    isValid(room, task) {
        // Make sure the target exists
        const obj = Game.getObjectById(task.target);
        if (!obj) return false;
        
        // Make sure the target still needs a tasker
        if (task.type === 'fill') return obj.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        if (task.type === 'build') return true; // The site exists, so it still needs to be built
        if (task.type === 'upgrade') {
            return !!obj; // If the controller exists, it's good to upgrade! It's never full
        }
        
        return false; // Default
    },
};