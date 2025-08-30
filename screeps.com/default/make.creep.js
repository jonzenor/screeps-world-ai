/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('spawn.creep');
 * mod.thing == 'a thing'; // true
 */
var makeCreep = {
    /** @param {room} room to spawn in **/
    /** @param {String} creepRole to spawn **/
    run: function(myRoom, creepRole) {
        var newName = creepRole + Game.time;
        console.log('Spawning new creep: ' + newName);
        const [spawn] = myRoom.find(FIND_MY_SPAWNS);

        if (!spawn || spawn.spawning) return ERR_BUSY;

        spawn.spawnCreep([WORK, WORK,CARRY,MOVE], newName,
            {memory: {role: creepRole}});
    }
};

module.exports = makeCreep;