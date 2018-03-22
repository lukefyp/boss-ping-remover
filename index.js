
// get ping automatically
    // to do
// commands
const Command = require('command');

module.exports = function BossPingRemover(dispatch) {
    // constants
        // to do: ping, command, config, fs, path

    // variables    
    zone = -1;
	enabled = true;
	command = Command(dispatch);
    
    // commands
	command.add(['bpr','boss'], ()=>{
		enabled = !enabled;
		command.message("Boss ping remover has been " + (enabled?"enabled.":"disabled."));
	});
        
    // hooks
        // to do: update protocol versions and get skill duration
    
    // sLoadTopo
	dispatch.hook('S_LOAD_TOPO', 1, e=>{
		if(e.zone != zone){
			cache = {};
		}
		mobsInArea = {};
		zone = e.zone;
	});
        
    // sSpawnNpc
		dispatch.hook('S_SPAWN_NPC', 4, e=>{
			if(cache[e.huntingZoneId] === undefined){
				try{
					cache[e.huntingZoneId] = require('./bosses/' + e.huntingZoneId.toString() + ".json");
				}catch(e){}
			}
			if(cache[e.huntingZoneId] !== undefined){
				mobsInArea[e.id.toString()] = {
					"id": e.templateId.toString(),
					"zone": e.huntingZoneId,
				};
			}
		});
        
    // sLogin
		dispatch.hook('S_LOGIN', 9, e=>{
			gameId = e.gameId;
		});
        
    // sDespawnNpc
		dispatch.hook('S_DESPAWN_NPC', 1, e=>{
			var source = e.target.toString();
			if(mobsInArea[source] !== undefined){
				delete mobsInArea[source];
			}
		});
        
    // sActionStage
		dispatch.hook('S_ACTION_STAGE', 1, e=>{
			if(!enabled || e.skill === undefined || gameId.equals(e.source)) return;
			
			var source = e.source.toString();
			if(mobsInArea[source] !== undefined){
                let skill = parseInt('0x' + e.skill.toString(16).slice(-4));
				var length = 0;
				for(var obj of e.movement){
					length += obj['duration'];
				}
				if(length == 0){
					try{
						length = cache[mobsInArea[source]['zone']][mobsInArea[source]['id']][skill];
					}catch(e){
						//console.log("[BPR]", mobsInArea[source], skill);
						return;
					}
				}
				var newSpeed = ((length * SPECIAL_LENGTH_MULTIPLIER) / (length - ping.getPing())) * e.speed;
				if(newSpeed > e.speed)
					e.speed = newSpeed;
				return true;
			}
        });
        
    // sActionEnd
        // to do: get actual skill duration and correct datacenter innaccuracy
}