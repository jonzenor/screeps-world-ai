/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('hud.overlay');
 * mod.thing == 'a thing'; // true
 */
 
 var roomCacheUtility = require('room.cache');

function workerCountOverlay(vis, room, codex, roomCreepCache) {
    // ----- Display Worker Counts ----- //
    vis.rect(1, 10, 8.5, (Object.keys(codex.manning).length + 1.1), {fill: '#000', opacity: 0.3, stroke: '#fff'});
    vis.text(`Manning`, 1.2, 11, {align: 'left', font: 0.9});
    
    let y = 12;
    const xL = 1.2;      // left column
    const xR = 9.0;      // right column edge

    for (const role of Object.keys(codex.manning)) {
        const have = roomCreepCache.creepsByRole[role] || 0;
        const need = codex.manning[role].count || 0;
    
        vis.text(role, xL, y, { align: 'left',  font: '0.7 monospace' });
        vis.text(`${have} / ${need}`, xR, y, { align: 'right', font: '0.7 monospace' });
    
        y += 0.9;
    }
}

module.exports = {
    render(room) {
        // Set the GUI Overlay for the room
        const vis = new RoomVisual(room.name);
        var codex = Memory.rooms[room.name].architect;
        var roomCreepCache = roomCacheUtility.getSection(room, 'creeps');

        workerCountOverlay(vis, room, codex, roomCreepCache);
    }
};