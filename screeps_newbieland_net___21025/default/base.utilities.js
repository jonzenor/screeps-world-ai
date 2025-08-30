/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.utilities');
 * mod.thing == 'a thing'; // true
 */
 function hasContainerNearSource(room, source) {
     var x = source.pos.x, y = source.pos.y;
     
     // Search for an active container
     var area = room.lookForAtArea(LOOK_STRUCTURES, y-1, x-1, y+1, x+1, true);
     if (_.some(area, function(r) { return r.structure.structureType === STRUCTURE_CONTAINER; })) return true;
     
     // Search for a container under construction
     area = room.lookForAtArea(LOOK_CONSTRUCTION_SITES, y-1, x-1, y+1, x+1, true);
     return _.some(area, function(r){ return r.constructionSite.structureType === STRUCTURE_CONTAINER; });
 }
 
 function sourcesNeedingContainer(room) {
     var sources = room.find(FIND_SOURCES);
     return _.filter(sources, function(s){ return !hasContainerNearSource(room, s); });
 }
 
 function pickContainerPosition(room, source, spawn) {
    var terrain = room.getTerrain();
    var x=source.pos.x, y=source.pos.y, xx, yy, rc;
    var ax = spawn.pos.x, ay = spawn.pos.y;
    
    var bestPlain = null, bestPlainScore = 1e9;
    var bestSwamp = null, bestSwampScore = 1e9;

    
    for (var dx=-1; dx<=1; dx++) for (var dy=-1; dy<=1; dy++) {
        if (!dx && !dy) continue;
        xx = x + dx; yy = y + dy;
        
        // Skip off the map locations
        if (xx<1 || xx>48 || yy<1 || yy>48) continue;
        
        var t = terrain.get(xx, yy);

        // Make sure the terrain is clear
        if (t === TERRAIN_MASK_WALL) continue;
        if (room.lookForAt(LOOK_STRUCTURES, xx, yy).length) continue;
        if (room.lookForAt(LOOK_CONSTRUCTION_SITES, xx, yy).length) continue;
        
        // Check the range to spawn
        var score = Math.max(Math.abs(ax - xx), Math.abs(ay - yy));
        
        if (t === TERRAIN_MASK_SWAMP) {
            if (score < bestSwampScore) {
                bestSwampScore = score;
                bestSwamp = new RoomPosition(xx, yy, room.name);
            }
        } else {
            if (score < bestPlainScore) {
                bestPlainScore = score;
                bestPlain = new RoomPosition(xx, yy, room.name);
            }
        }
    }
    
    return bestPlain || bestpSwamp || null;
 }

module.exports = {
    autoPlanExtensions(room) {
      var ctrl = room.controller;
      if (!ctrl || !ctrl.my || ctrl.level < 2) return;
    
      var limit  = (CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][ctrl.level] || 0);
      var have   = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length;
      var queued = room.find(FIND_MY_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_EXTENSION}).length;
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
    
    cleanUpCreepMemory() {
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    },
    
    autoPlanContainers(room) {
        var roomSources = room.find(FIND_SOURCES);
        var roomSpawn = room.find(FIND_MY_SPAWNS)[0];
        
        // If there are no containers, then build the first one at the nearest source
        var containerCount = room.find(STRUCTURE_CONTAINER).length;
        var activeConstructions = room.find(FIND_CONSTRUCTION_SITES, {filter:s=>s.structureType===STRUCTURE_CONTAINER}).length;
        
        if (activeConstructions > 0) {
            return;
        }
        
        // Find sources that need a container
        var sourceCandidates = sourcesNeedingContainer(room);
        if (roomSpawn && sourceCandidates.length) {
            var best = _.min(sourceCandidates, function(s) {
                var r = PathFinder.search(roomSpawn.pos, {pos:s.pos, range:1}, {plainCost:2, swampCost:10});
                return r.incomplete ? 9999 : r.path.length;
            });
        }
        
        // Find a spot to build the container
        var constructionSite = pickContainerPosition(room, best, roomSpawn);
        
        buildResult = room.createConstructionSite(constructionSite.x, constructionSite.y, STRUCTURE_CONTAINER);
        
        return buildResult;
    }
};