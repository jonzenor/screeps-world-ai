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
    if (!Memory.rooms[room.name].architect) Memory.rooms[room.name].architect = { state: {v: 1, last: Game.time, planStep: 'init' }, sources: {}, structures: {}, constructions: {}, plan: {} };
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
    codex.structures.containers = {};
    codex.structures.controller = {};
    
    codex.state.planStep = 'discover';
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
    
    codex.state.planStep = 'calculateDistances';
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
    
    codex.state.planStep = 'planContainers';
}

module.exports = {
    run(room) {
        var codex = loadMemory(room);
        
        if (codex.state.planStep == 'init') {
            initBase(codex, room);
        } else if (codex.state.planStep == 'discover') {
            discoverBaseResources(codex, room);
        } else if (codex.state.planStep == 'calculateDistances') {
            calculateBaseResourceDistances(codex, room);
        }
    }
};