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
        
        if (!roomCache || roomCache.tick !== Game.time) {
            // Initialize Cache
            roomCache = global.__cache.rooms[room.name] = { 
                tick: Game.time,
                creeps: {
                    tick: 0,
                    creepsCount: 0,
                    creepsByRole: {}
                },
                architect: {
                    tick: 0,
                    needed: {},
                    counts: {}
                }
            }
        }
    },
    
    get(room) {
        return global.__cache.rooms[room.name];
    },
    
    getSection(room, key) {
        return global.__cache.rooms[room.name][key];
    },
};