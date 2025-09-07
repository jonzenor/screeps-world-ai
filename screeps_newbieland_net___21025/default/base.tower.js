/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('base.tower');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    run(tower) {
        var hostiles = tower.room.find(FIND_HOSTILE_CREEPS);

        if (hostiles.length) {
            var target = tower.pos.findClosestByRange(hostiles);
            tower.attack(target);
            return;
        }
        
        var wounded = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: function(c){ return c.hits < c.hitsMax; }
        });
        
        if (wounded) { tower.heal(wounded); return; }
    }
};