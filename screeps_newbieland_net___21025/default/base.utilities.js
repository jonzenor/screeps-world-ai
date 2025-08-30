/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.utilities');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    autoPlanExtensions(room) {
      var ctrl = room.controller;
      if (!ctrl || !ctrl.my || ctrl.level < 2) return;
    
      var limit = (CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][ctrl.level] || 0);
      var have  = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length;
      var queued= room.find(FIND_MY_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length;
      if (have + queued >= limit) return;
    
      var spawn = room.find(FIND_MY_SPAWNS)[0];
      if (!spawn) return;
    
      var terrain = room.getTerrain();
      var sx = spawn.pos.x, sy = spawn.pos.y;
    
      // search rings around spawn
      for (var r = 1; r <= 3; r++) {
        for (var dx = -r; dx <= r; dx++) {
          for (var dy = -r; dy <= r; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
            var x = sx + dx, y = sy + dy;
            if (x < 1 || x > 48 || y < 1 || y > 48) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            if (room.lookForAt(LOOK_STRUCTURES, x, y).length) continue;
            if (room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y).length) continue;
    
            var rc = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
            if (rc === OK) { console.log('Queued extension at', x, y); return; }
          }
        }
      }
    },
};