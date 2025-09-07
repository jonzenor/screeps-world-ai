/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.architect');
 * mod.thing == 'a thing'; // true
 */
 var roomCacheUtility = require('room.cache');

function loadMemory(room) {
    if (!Memory.rooms) { Memory.rooms = {}; }
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].architect) Memory.rooms[room.name].architect = { state: {v: 1, last: Game.time, planStep: 'init' }, sources: {}, structures: {}, plan: [], planIndex: {} };
    
    if (!Memory.debug) {
        Memory.debug = {};
    }
    
    return Memory.rooms[room.name].architect;
}

function initBase(codex, room) {
    console.log('Architect: Initilizing Base - ' + Game.time);
    codex.state.level = room.controller.level;
    codex.manning = {
        fastworker: { count: 1, priority: 1 },
        worker: { count: 2, priority: 5 },
        miner: { count: 0, priority: 10 },
    };
    
    codex.structures.mainSpawn = {};
    codex.structures.containers = [];
    codex.structures.storage = [];
    codex.structures.mainTurret = {};
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
        var availableTiles = getAvailableNeighboringTiles(thisSource.pos, room, codex);
        
        codex.sources[thisSource.id] = {
            x: thisSource.pos.x,
            y: thisSource.pos.y,
            distanceToSpawn: 0,
            distanceToController: 0,
            lastDistanceCalc: 0,
            freeSpaces: availableTiles.length,
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
        var usePriority = (planSite == 'mainSpawn') ? 2 : 4;
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
    if (!codex.plan) codex.plan = [];
    var key = useTile.x + ',' + useTile.y;
    codex.planIndex[key] = 'container';
    
    codex.plan.push({
        type: STRUCTURE_CONTAINER,
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
}

function planRoomContainers(codex, room) {
    planContainerNextToTargetsNearestSource(room, 'mainSpawn', codex, '');
    planContainerNextToTargetsNearestSource(room, 'controller', codex, codex.structures.mainSpawn.nearestSource);
    planContainerSiteNextToSource(room, codex);
}

//----- Turret -----//
function findNearestBuildableTile(centerPoint, room, codex, maxRange) {
    var terrain = Game.map.getRoomTerrain(room.name);
    
    for (var r = 0; r <= maxRange; r++) {
        for (var dx = -r; dx <= r; dx++) {
            for (var dy = -r; dy <= r; dy++) {
                
                // Ignore the center point
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                
                var x = centerPoint.x + dx, y = centerPoint.y + dy;
                
                // Ignore points outside the map
                if (x < 0 || x > 49 || y < 0 || y > 49) continue;
                
                // Ignore walls
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                
                // Ignore sites reserved for other builds
                var key = x + ',' + y;
                if (codex.planIndex && codex.planIndex[key]) continue;
                
                return { x:x, y:y, terrain: terrain.get(x, y) };
            }
        }
    }
    
    return null;
}

function ringTiles(center, radius) {
    var out = [];
    for (var dx = -radius; dx <= radius; dx ++) {
        for (var dy = -radius; dy <= radius; dy ++) {
            if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
            out.push({x: center.x + dx, y: center.y + dy});
        }
    }
    return out;
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
            codex.state.planStep = 'planTurret';
            
        } else if (codex.state.planStep == 'planTurret') {
            // Find the midpoint between spawn and controller
            var mainSpawn = Game.getObjectById(codex.structures.mainSpawn.id);
            var controller = Game.getObjectById(codex.structures.controller.id);
            
            var midpointX = Math.floor((mainSpawn.pos.x + controller.pos.x) / 2);
            var midpointY = Math.floor((mainSpawn.pos.y + controller.pos.y) / 2);
            var midpoint = {x: midpointX, y: midpointY };
            
            var towerSite = findNearestBuildableTile(midpoint, room, codex, 4);
            
            // Tag the site for building
            codex.structures.mainTurret = {
                id: null,
                x: towerSite.x,
                y: towerSite.y,
                nearestSource: null,
                nearestContainer: null,
                nearestStorage: null
            };
            
            codex.plan.push({
                type: STRUCTURE_TOWER,
                x: towerSite.x,
                y: towerSite.y,
                priority: 1,
                rcl: 3,
                siteId: null,
                status: 'planned',
            });

            var key = towerSite.x + ',' + towerSite.y;
            codex.planIndex[key] = 'turret';
            console.log('ARCHITECT: Planned Turret site at ' + key);
            
            codex.state.planStep = 'planTurretMote';
        } else if (codex.state.planStep == 'planTurretMote') {
            var towerSite = {x: codex.structures.mainTurret.x, y: codex.structures.mainTurret.y };
            
            // Get free tiles near the turret, tag the mote as unusuable
            var moteTiles = getAvailableNeighboringTiles(towerSite, room, codex);
            _.forEach(moteTiles, function(tile, index) {
                key = tile.x + ',' + tile.y;
                codex.planIndex[key] = 'mote';
            });
            console.log('ARCHITECT: Planned mote around turret');
            
            codex.state.planStep = 'planTurretStorage';
        } else if (codex.state.planStep == 'planTurretStorage') {
            var turretSite = {x: codex.structures.mainTurret.x, y: codex.structures.mainTurret.y };
            var spawnSite = {x: codex.structures.mainSpawn.x, y: codex.structures.mainSpawn.y };

            var terrain = Game.map.getRoomTerrain(room.name);
            var dx = Math.sign(spawnSite.x - turretSite.x);
            var dy = Math.sign(spawnSite.y - turretSite.y);
            
            // The storage site should be 2 spaces away from the turret
            // Because of the mote we have around the turrent
            var storageSite = {x: turretSite.x + 2*dx, y: turretSite.y + 2*dy };
            
            var storageKey = storageSite.x + ',' + storageSite.y;
            if (codex.planIndex && codex.planIndex[storageKey]) {
                console.log('ARCHITECT ERROR: Invalid Turret Storage container location!');
            } else {
                codex.planIndex[storageKey] = 'storage';

                codex.plan.push({
                    type: STRUCTURE_STORAGE,
                    x: storageSite.x,
                    y: storageSite.y,
                    priority: 4,
                    rcl: 4,
                    siteId: null,
                    status: 'planned',
                });
            }
            
            // Plan the location of the container next to the storage
            var possibleContainerTiles = getAvailableNeighboringTiles(storageSite, room, codex);
            var containerSite = chooseNearestSpotToTarget(possibleContainerTiles, turretSite);
            
            if (!containerSite) {
                console.log('ARCHITECT ERROR: Could not locate valid Turret container site');
            } else {
                var containerKey = containerSite.x + ',' + containerSite.y;
                codex.planIndex[containerKey] = 'container';

                codex.plan.push({
                    type: STRUCTURE_CONTAINER,
                    x: containerSite.x,
                    y: containerSite.y,
                    priority: 3,
                    rcl: 3,
                    siteId: null,
                    status: 'planned',
                });
                
            }
            console.log('ARCHITECT: Planned storage system near Turret: ' + storageKey + ' ' + containerKey);
            codex.state.planStep = 'planContainers';
        } else if (codex.state.planStep == 'planContainers') {
            planRoomContainers(codex, room);
            console.log('ARCHITECT: Planned room containers');
            codex.state.planStep = 'planExtensions';
            
        } else if (codex.state.planStep == 'planExtensions') {
            // Get the location of the turret
            var turretSite = {x: codex.structures.mainTurret.x, y: codex.structures.mainTurret.y };
            var extensionSites = ringTiles(turretSite, 2);
            var extensionCount = 0;
            var buildLevel = 2;
            
            _.forEach(extensionSites, function(p) {
                var key = p.x + ',' + p.y;
                if (!codex.planIndex[key]) {
                    extensionCount ++;
                    var usePriority = (extensionCount == 1) ? 3 : 4;
                    if (extensionCount <= 5) { buildLevel = 2; }
                    else if (extensionCount <= 10) { buildLevel = 3; }
                    else { buildLevel = 4; }
                    
                    codex.planIndex[key] = 'extension';
                    codex.plan.push({
                        type: STRUCTURE_EXTENSION,
                        x: p.x,
                        y: p.y,
                        rcl: buildLevel,
                        priority: usePriority,
                        siteId: null,
                        status: 'planned'
                    });
                }
            });
            console.log('ARCHITECT: Planned extensions for sites: ' + extensionCount);
            
            codex.state.planStep = 'complete';
            console.log('ARCHITECT: Base planning phase completed.');
        }
        
        // Cache how many structures we have, but this doesn't change super often, so not every tick
        var roomCache = roomCacheUtility.getSection(room, 'architect');
        if (!roomCache.tick || Game.time >= roomCache.tick + 10 || codex.state.level != room.controller.level) {
            
            if (codex.state.level != room.controller.leve) {
                roomCache.sleepConstruction = 0;
            }
            
            roomCache.tick = Game.time;
            codex.state.level = room.controller.level;
            roomCache.counts.constructions = room.find(FIND_CONSTRUCTION_SITES).length
            roomCache.counts.containers = room.find(FIND_STRUCTURES, {filter: function(s){ return s.structureType === STRUCTURE_CONTAINER; }}).length;
            roomCache.counts.extensions = room.find(FIND_STRUCTURES, {filter: function(s){ return s.structureType === STRUCTURE_EXTENSION; }}).length;
            roomCache.counts.towers = room.find(FIND_STRUCTURES, {filter: function(s){ return s.structureType === STRUCTURE_TOWER; }}).length;
            roomCache.counts.containerConstructions = room.find(FIND_CONSTRUCTION_SITES, {filter: function(s) { return s.structureType === STRUCTURE_CONTAINER; }}).length;

            if (room.controller.level == 1) {
                roomCache.needed.constructions = 0;
                roomCache.needed.containers = 0;
                roomCache.needed.extensions = 0;
                roomCache.needed.towers = 0;
            } else if (room.controller.level == 2) {
                roomCache.needed.constructions = 2;
                roomCache.needed.containers = 3;
                roomCache.needed.extensions = 5;
                roomCache.needed.towers = 0;
                
                codex.manning.miner = {priority: 1, count: (roomCache.counts.containers + roomCache.counts.containerConstructions) };
                codex.manning.fastworker = {priority: 4, count: 3 };
                codex.manning.worker = {priority: 5, count: 3 };
            } else if (room.controller.level == 3) {
                roomCache.needed.constructions = 2;
                roomCache.needed.containers = 5;
                roomCache.needed.extensions = 10;
                roomCache.needed.towers = 1;
                codex.manning.miner = {priority: 1, count: (roomCache.counts.containers + roomCache.counts.containerConstructions) };
                codex.manning.fastworker = {priority: 4, count: 3 };
                codex.manning.worker = {priority: 5, count: 3 };

            }
        }
        
        // Build sites that are needed
        if ((Game.time >= roomCache.sleepConstruction) && roomCache.counts.constructions < roomCache.needed.constructions ) {
            console.log('Build site available...');
            var toBuild = _.chain(codex.plan)
                .filter(function(p) { return p && p.status === 'planned' && p.rcl <= codex.state.level})
                .sortBy(function(p) { return p.priority == null ? 999 : p.priority; })
                .value();
            
            if (toBuild.length) {
                console.log('Base plan retrieved');
                var plan = toBuild[0];
                var buildResponse = room.createConstructionSite(plan.x, plan.y, plan.type);
                
                if (buildResponse === OK) {
                    // Get the site id
                    console.log('ARCHITECT: Started construction: ' + JSON.stringify(plan));
                    var buildSite = _.first(room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y));
                    plan.status = 'building';
                    plan.siteId = buildSite ? buildSite.id : null;
                    plan.nextCheck = Game.time + 50;
                    plan.lastProgress = 0;
                    roomCache.counts.constructions ++;
                    
                    if (plan.type === STRUCTURE_CONTAINER) {
                        if (plan.sourceId) {
                            var containerSource = codex.sources[plan.sourceId];
                            containerSource.containerStatus = 'building';
                        }
                    }
                } else {
                    console.log('ARCHITECT ERROR: Failed to start construction: ' + buildResponse + ' - ' + JSON.stringify(plan));
                }
            } else {
                console.log('Sleeping construction');
                roomCache.sleepConstruction = Game.time + 100;
            }
        }
        
        // Check on building progress
        var buildSites = _.chain(codex.plan)
            .filter(function(p) { return p && p.state === 'building' && p.nextCheck <= Game.time})
            .value();
        
        if (buildSites && buildSites.length > 0) {
            _.forEach(buildSites, function(buildSite) {
                var site = Game.getObjectById(buildSite.siteId);
                
                if (site) {
                    buildSite.lastProgress = (site.progress / site.progressTotal) || 0;
                    var checkDelay = (buildSite.lastProgress > 0.8) ? 10 : 50;
                    buildSite.nextCheck = Game.time + checkDelay;
                } else {
                    var newStructure = _.first(room.lookForAt(LOOK_STRUCTURES, x, y));
                    if (!newStructure) {
                        // Something failed, requeue
                        buildSite.state = 'planned';
                    } else {
                        buildSite.state = 'completed';
    
                        if (buildSite.type === STRUCTURE_CONTAINER) {
                            if (buildSite.sourceId) {
                                var containerSource = codex.sources[plan.sourceId];
                                containerSource.containerId = newStructure.id;
                                containerSource.containerStatus = 'ready';
                            }
                        }
                    }
                }
            });
        }
    }
};