/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.architect');
 * mod.thing == 'a thing'; // true
 */

function loadMemory(room) {
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].architect) Memory.rooms[room.name].architect = { state: {v: 1, last: Game.time, planStep: 'init' }, sources: {}, structures: {}, constructions: {}, plan: {}, planIndex: {} };
    return Memory.rooms[room.name].architect;
}

function initBase(codex, room) {
    console.log('Architect: Initilizing Base - ' + Game.time);
    codex.state.level = 1;
    codex.manning = {
        fastworker: { count: 1, priority: 1 },
        worker: { count: 3, priority: 5 },
        miner: { count: 0, priority: 10 },
    };
    
    codex.structures.mainSpawn = {};
    codex.structures.containers = [];
    codex.structures.controller = {};
}

function discoverBaseResources(codex, room) {
    // Get initial scan of the room
    console.log('Architect: scanning the room - ' + Game.time);
    
    // Save spawner id and location
    var spawner = room.find(FIND_MY_SPAWNS)[0];
    codex.structures.mainSpawn = {
        id: spawner.id,
        x: spawner.pos.x,
        y: spawner.pos.y,
        nearestSource: '',
        containerPos: {},
        containerStatus: '',
    }
    
    // Save controller id and location
    codex.structures.controller = {
        id: room.controller.id,
        x: room.controller.pos.x,
        y: room.controller.pos.y,
        nearestSource: '',
    }
    
    // Save the sources
    var sources = room.find(FIND_SOURCES);
    _.forEach(sources, function(thisSource) {
        codex.sources[thisSource.id] = {
            x: thisSource.pos.x,
            y: thisSource.pos.y,
            distanceToSpawn: 0,
            distanceToController: 0,
            lastDistanceCalc: 0,
        }
    });
}

function calculateBaseResourceDistances(codex, room) {
    console.log('Architect: Starting distance calculations - ' + Game.time);
    var spawner = codex.structures.mainSpawn;
    var controller = codex.structures.controller;
    
    var closestToSpawnId = '';
    var closestToSpawnDistance = 1e9;
    
    var closestToControllerId = '';
    var closestToControllerDistance = 1e9;
    
    if (!spawner || !controller) { console.log('Architect: ERROR missing main structure!'); return; }
    
    _.forEach(codex.sources, function(thisSource, thisSourceId) {
        thisSource.distanceToSpawn = Math.abs(thisSource.x - spawner.x) + Math.abs(thisSource.y - spawner.y);
        thisSource.distanceToController = Math.abs(thisSource.x - controller.x) + Math.abs(thisSource.y - controller.y);
        thisSource.lastDistanceCalc = Game.time;
        
        if (thisSource.distanceToSpawn < closestToSpawnDistance) {
            closestToSpawnId = thisSourceId;
            closestToSpawnDistance = thisSource.distanceToSpawn;
        }
        
        if (thisSource.distanceToController < closestToControllerDistance) {
            closestToControllerId = thisSourceId;
            closestToControllerDistance = thisSource.distanceToController;
        }
    });
    
    spawner.nearestSource = closestToSpawnId;
    controller.nearestSource = closestToControllerId;
}

function getAvailableNeighboringTiles(pos, room, codex) {
    var terrain = Game.map.getRoomTerrain(room.name);
    var availableTiles = [];
    
    for (var dx = -1; dx <= 1; dx ++) {
        for (var dy =-1; dy <= 1; dy ++) {
            
            // Skip checking the center tile
            if (dx === 0 && dy === 0) continue;
            
            var x = pos.x + dx, y = pos.y + dy;
            
            // Disqualify tiles outside the map
            if (x < 0 || x > 49 || y < 0 || y > 49) continue;
            
            // Disqualify if there is a plan to build something there already
            var key = x + ',' + y;
            if (codex.planIndex[key]) { continue; }
            
            var tileTerrain = terrain.get(x, y); // 0 = plain, 1 = wall, 2 = swamp
            
            if (tileTerrain !== TERRAIN_MASK_WALL) {
                availableTiles.push({ x: x, y: y, terrain: tileTerrain});
            }
        }
    }
    
    return availableTiles;
}

// Of the given tiles, which is the closest to the target
function chooseNearestSpotToTarget(tiles, targetPos) {
    var bestPos = null;
    var bestScore = 1e9;
    
    _.forEach(tiles, function(t) {
        var distance = Math.abs(t.x - targetPos.x) + Math.abs(t.y - targetPos.y);
        var swampPenalty = (t.terrain === TERRAIN_MASK_SWAMP) ? 2 : 0;
        var score = distance + swampPenalty;
        
        if (score < bestScore) { 
           bestScore = score;
           bestPos = t
        }
    });
    
    return bestPos;
}

function pickNearestSourceExcluding(planSite, codex, avoidId){
  var target = codex.structures[planSite]; // {x,y,nearestSource}
  var bestId = null, bestD = 1e9;

  _.forEach(codex.sources, function(src, id){
    if (id === avoidId) return;
    var d = Math.abs(src.x - target.x) + Math.abs(src.y - target.y);
    if (d < bestD){ bestD = d; bestId = id; }
  });

  // fallback: use the precomputed nearest if exclusion exhausted
  return bestId || codex.structures[planSite].nearestSource;
}


function planContainerNextToTargetsNearestSource(room, planSite, codex, avoidSource) {
    // Plan nearest to spawn
    var siteSource = null;
    
    if (avoidSource != '' && codex.structures[planSite].nearestSource == avoidSource) {
        var siteSourceId = pickNearestSourceExcluding(planSite, codex, avoidSource);
        siteSource = Game.getObjectById(siteSourceId);
    } else {
        siteSource = Game.getObjectById(codex.structures[planSite].nearestSource);
    }
    
    var tiles = getAvailableNeighboringTiles(siteSource.pos, room, codex);
    codex.structures[planSite].buildableTilesCount = tiles.length;

    // TODO what to do when there are no available tiles?
    if (!tiles) {
        console.log('ARCHITECT ERROR: No available tiles for site: ' + siteSource.pos);
        return;
    }
    
    var useTile = chooseNearestSpotToTarget(tiles, siteSource.pos);
    
    if (!useTile) {
        console.log('ARCHITECT ERROR: No useable container site found for source ' + planSite);
    } else {
        var usePriority = (planSite == 'mainSpawn') ? 1 : 3;
        recordSourceContainerSite(codex, siteSource, useTile, usePriority)
    }
}

function planContainerSiteNextToSource(room, codex) {
    _.forEach(codex.sources, function(src, id) {
        
        // Check if the source has a build site already
        if (src.containerStatus && src.containerStatus == 'planned') {
            return;
        }
        
        var thisSource = Game.getObjectById(id);
        
        if (!thisSource) {
            console.log('ARCHITECT ERROR: Room source has vanished! ' + id);
            return;
        }
        
        // Plan the build site
        // This needs the codex so it can look up if certain sites are called for already
        var tiles = getAvailableNeighboringTiles(thisSource.pos, room, codex);
        
        if (!tiles) {
            console.log('ARCHITECT ERROR: No available tiles for site: ' + thisSource.id);
            return;
        }
        
        var useTile = chooseNearestSpotToTarget(tiles, thisSource.pos);
        if (!useTile) {
            console.log('ARCHITECT ERROR: No useable container site found for source ' + thisSource.id);
        } else {
            recordSourceContainerSite(codex, thisSource, useTile, 5);
        }
    });
}

function recordSourceContainerSite(codex, siteSource, useTile, usePriority) {
    if (!codex.plan.containers) codex.plan.containers = [];
    var key = useTile.x + ',' + useTile.y;
    codex.planIndex[key] = 'container';
    
    codex.plan.containers.push({
        x: useTile.x,
        y: useTile.y,
        priority: usePriority,
        rcl: 2,
        sourceId: siteSource.id,
        siteId: null,
        status: 'planned',
    });
    
    // codex.sources[spawnSource.id].plannedContainer = {x: useTile.x, y: useTile.y};
    codex.sources[siteSource.id].containerId = null;
    codex.sources[siteSource.id].containerStatus = 'planned';
    
    console.log('Saved container site for ' + siteSource);
}

function planRoomContainers(codex, room) {
    planContainerNextToTargetsNearestSource(room, 'mainSpawn', codex, '');
    planContainerNextToTargetsNearestSource(room, 'controller', codex, codex.structures.mainSpawn.nearestSource);
    planContainerSiteNextToSource(room, codex);
}

module.exports = {
    run(room) {
        var codex = loadMemory(room);
        
        // Using else if here so that each step only fires one of these phases
        if (codex.state.planStep == 'init') {
            initBase(codex, room);
            codex.state.planStep = 'discover';
            
        } else if (codex.state.planStep == 'discover') {
            discoverBaseResources(codex, room);
            codex.state.planStep = 'calculateDistances';
            
        } else if (codex.state.planStep == 'calculateDistances') {
            calculateBaseResourceDistances(codex, room);
            codex.state.planStep = 'planContainers';
            
        } else if (codex.state.planStep == 'planContainers') {
            planRoomContainers(codex, room);
            codex.state.planStep = 'planTurret';
            
        }
        
        // Plan turret
        
        // Plan extension sites
        
        // Update conditions based on RC level when that change happens
        
        // Build sites that are needed
    }
};