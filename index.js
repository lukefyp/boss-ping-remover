const fs = require('fs'),
    path = require('path'),
    Ping = require('./ping.js'),
    Command = require('command')

module.exports = function getBossSkills(dispatch) {
    // constants
    const ping = Ping(dispatch),
        command = Command(dispatch)
        config = require('./config.json')

    // variables
    let zone = -1,
        mobs = {},
        cache = {},
        currentActions = {},
        reading = [],
        writing = []

    // commands
    command.add('bpr', (arg) => {
        if (arg && arg.toLowerCase() == 'debug') config.debug = !config.debug
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
    
    this.destructor = () => {
        if (config.enabled) writeCache(cache)
    }
    
    // async write for performance
    function writeCache(cache) {
        clean(cache)
        for (let huntingZoneId in cache) {
            // if being written, don't retry
            if (!writing.includes(huntingZoneId)) {
                writing.push(huntingZoneId)
                fs.writeFile(path.join(__dirname, 'data', `${huntingZoneId}.json`), JSON.stringify(cache[huntingZoneId], null, '\t'), (err) => {
                    writing.splice(writing.indexOf(huntingZoneId), 1)
                    if (err) return
                    if (config.debug) console.log(`data/${huntingZoneId}.json written`)
                })
            }
        }
    }

    // delete empty objects inside an object
    function clean(obj) {
        for (let key in obj) {
            if (obj[key] && typeof obj[key] === "object") {
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key]
                }
                else {
                    clean(obj[key])
                }
            }
        }
    }

    // async read for performance
    function readData(huntingZoneId) {
        // if being read, don't retry
        if (!reading.includes(huntingZoneId)) {
            if (!writing.includes(huntingZoneId)) {
                reading.push(huntingZoneId)
                fs.readFile(path.join(__dirname, 'data', `${huntingZoneId}.json`), 'utf8', (err, data) => {
                    reading.splice(reading.indexOf(huntingZoneId), 1)
                    if (err) return
                    Object.assign(cache[huntingZoneId], JSON.parse(data))
                    if (config.debug) console.log(`data/${huntingZoneId}.json read`)
                })
            }
            // if being written, try again later
            else {
                setTimeout(readData, 500, huntingZoneId)
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
            // if not cached, try to read from data folder
            if (!cache[huntingZoneId]) {
                cache[huntingZoneId] = {}
                readData(huntingZoneId)
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
                if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] <* sActionStage ${huntingZoneId} ${templateId} ${skill}` 
                    + `s${event.stage} bpr${Math.min(ping.avg,Math.floor(length/event.speed-1000/config.minCombatFPS))}`)
                event.speed = event.speed * length / Math.max(length - ping.avg * event.speed, 1000/config.minCombatFPS)
                return true
            }
            if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] <- sActionStage ${huntingZoneId} ${templateId} ${skill} s${event.stage}`)
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
            if (config.debug) console.log(`[${Date.now().toString().slice(-4)}] <- sActionEnd ${huntingZoneId} ${templateId} ${skill} t${event.type} ${time}ms`)
            if (event.type == 0) {
                if (!cache[huntingZoneId][templateId]) cache[huntingZoneId][templateId] = {}
                cache[huntingZoneId][templateId][skill] = cache[huntingZoneId][templateId][skill] ? (cache[huntingZoneId][templateId][skill] + time) / 2 : time
            }
        }
    })

    /*
    // S_EXIT
    dispatch.hook('S_EXIT', 'raw', {order: -999, filter: {fake: null}}, () => {
        if (config.enabled) writeCache(cache)
    })
    */
}
