const fs = require('fs'),
    path = require('path'),
    Ping = require('./ping.js'),
    Command = require('command')

module.exports = function BossPingRemover(dispatch) {
    // constants
    const ping = Ping(dispatch),
        command = Command(dispatch),
        config = require('./config.json'),
        data = require('./data.json')

    // variables
    let zone = -1,
        mobs = {},
        cache = {},
        currentActions = {},
        writing = false

    // commands
    command.add('bpr', (arg) => {
        if (arg && arg.toLowerCase() == 'debug') {
            config.debug = !config.debug
            command.message(`Boss Ping Remover debug ${config.debug ? 'enabled' : 'disabled'}.`)
        }
        else {
            config.enabled = !config.enabled
            command.message(`Boss Ping Remover ${config.enabled ? 'enabled' : 'disabled'}.`)
            if (!config.enabled) {
                writeCache(cache)
                zone = -1
                cache = {}
                mobs = {}
                currentActions = {}
            }
        }
    })
    
    // write cache on disconnect
    this.destructor = () => {
        if (config.enabled) writeCache(cache)
    }
    
    // async write for performance
    function writeCache(cache) {
        clean(cache)
        Object.assign(data, cache)
        // if being written, don't retry
        if (!writing) {
            writing = true
            fs.writeFile(path.join(__dirname, 'data.json'), JSON.stringify(data, null, '\t'), (err) => {
                writing = false
                if (err) return
                if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] "data.json" written`)
            })
        }
    }

    // delete empty objects inside an object
    function clean(obj) {
        for (let key in obj) {
            if (obj[key] && typeof obj[key] === "object") {
                if (Object.keys(obj[key]).length !== 0) {
                    clean(obj[key])
                }
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key]
                }
            }
        }
    }

    // S_SPAWN_NPC
    dispatch.hook('S_SPAWN_NPC', 6, {filter: {fake: null}}, event => {
        if (config.enabled) {
            let mobId = JSON.stringify(event.gameId),
                huntingZoneId = event.huntingZoneId,
                templateId = event.templateId
            mobs[mobId] = huntingZoneId
            // if not cached, try to read from data
            if (!cache[huntingZoneId]) {
                if (data[huntingZoneId]) cache[huntingZoneId] = data[huntingZoneId]
                else cache[huntingZoneId] = {}
            }
            if (!cache[huntingZoneId][templateId]) cache[huntingZoneId][templateId] = {}
        }
    })

    // S_DESPAWN_NPC
    dispatch.hook('S_DESPAWN_NPC', 3, {filter: {fake: null}}, event => {
        if (config.enabled) {
            let mobId = JSON.stringify(event.gameId)
            if (mobs[mobId]) delete mobs[mobId]
            if (currentActions[mobId]) delete currentActions[mobId]
        }
    })

    // S_LOAD_TOPO
    dispatch.hook('S_LOAD_TOPO', 3, event => {
        if (config.enabled) {
            if (zone != event.zone) {
                writeCache(cache)
                cache = {}
            }
            zone = event.zone
            mobs = {}
            currentActions = {}
        }
    })

    // S_ACTION_STAGE
    dispatch.hook('S_ACTION_STAGE', 4, event => {
        let mobId = JSON.stringify(event.gameId),
            huntingZoneId = mobs[mobId],
            templateId = event.templateId,
            skill = parseInt('0x' + event.skill.toString(16).slice(-4))
        if (huntingZoneId) {
            // if multi stage, do not update start time
            if (currentActions[mobId] && event.id == currentActions[mobId].id && event.stage > currentActions[mobId].stage) {
                currentActions[mobId] = {
                    time: currentActions[mobId].time,
                    speed: event.speed,
                    stage: event.stage,
                    id: event.id
                }
            }
            else {
                currentActions[mobId] = {
                    time: Date.now(),
                    speed: event.speed,
                    stage: event.stage,
                    id: event.id
                }
            }
            if (!cache[huntingZoneId][templateId]) cache[huntingZoneId][templateId] = {}
            let length = cache[huntingZoneId][templateId][skill]
            if (length > 0) {
                // shorten by ping
                if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] <* sActionStage ${huntingZoneId}-${templateId}-${skill}` 
                    + ` s${event.stage} d${Math.floor(length)} bpr${Math.floor(Math.min(ping.avg, length/event.speed-1000/config.minCombatFPS))}`)
                event.speed = event.speed * length / Math.max(length - ping.avg * event.speed, 1000/config.minCombatFPS)
                return true
            }
            if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] <- sActionStage ${huntingZoneId}-${templateId}-${skill} s${event.stage} d0 bpr0`)
        }
    })

    // S_ACTION_END
    dispatch.hook('S_ACTION_END', 3, event => {
        let mobId = JSON.stringify(event.gameId),
            huntingZoneId = mobs[mobId],
            templateId = event.templateId,
            skill = parseInt('0x' + event.skill.toString(16).slice(-4))
        if (huntingZoneId && currentActions[mobId] && currentActions[mobId].id == event.id) {
            let time = (Date.now() - currentActions[mobId].time) / currentActions[mobId].speed
            delete currentActions[mobId]
            if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] <- sActionEnd ${huntingZoneId}-${templateId}-${skill} t${event.type} d${time}`)
            if (event.type == 0) {
                if (!cache[huntingZoneId][templateId]) cache[huntingZoneId][templateId] = {}
                cache[huntingZoneId][templateId][skill] = cache[huntingZoneId][templateId][skill] ? (cache[huntingZoneId][templateId][skill] + time) / 2 : time
            }
        }
    })
}
