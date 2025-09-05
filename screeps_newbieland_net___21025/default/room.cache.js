/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('room.cache');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    init(room) {
        if (!global.__cache) global.__cache = { rooms: {} };
        
        var roomCache = global.__cache.rooms[room.name];
        
        if (!roomCache) {
            // Initialize Cache
            console.log('initializing Cache');
            roomCache = global.__cache.rooms[room.name] = {
                tick: Game.time
            };
        }
        
        if (!roomCache.creeps) {
            roomCache.creeps = {
                tick: -1,
                creepsCount: 0,
                creepsByRole: {}
            };
        }
        
        if (!roomCache.architect) {
            roomCache.architect = {
                tick: -1,
                needed: {},
                counts: {}
            };
        }
        
        if (!roomCache.sourceQueue) {
            roomCache.sourceQueue = {
                tick: -1,
            };
        }
    },
    
    get(room) {
        return global.__cache.rooms[room.name];
    },
    
    getSection(room, key) {
        return global.__cache.rooms[room.name][key];
    },
};