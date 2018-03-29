const fs = require('fs'),
    path = require('path'),
    Ping = require('./ping.js')

module.exports = function getBossSkills(dispatch) {
    // constants
    const ping = Ping(dispatch),
        config = require('./config.json')

    // variables
    let zone = -1,
        mobs = {},
        cache = {},
        currentActions = {},
        reading = [],
        writing = []
    
    // async write for performance
    function writeCache(cache) {
        for (let huntingZoneId in cache) {
            // if being written, don't retry
            if (!writing.includes(huntingZoneId)) {
                writing.push(huntingZoneId)
                fs.writeFile(path.join(__dirname, 'data', `${huntingZoneId}.json`), JSON.stringify(cache[huntingZoneId], null, '\t'), (err) => {
                    writing.splice(writing.indexOf(huntingZoneId), 1)
                    if (err) return
                })
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
                })
            }
            // if being written, try again later
            else {
                setTimeout(readData, 500, huntingZoneId)
            }
        }
    }

    // S_SPAWN_NPC
    dispatch.hook('S_SPAWN_NPC', 6, event => {
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
    })

    // S_DESPAWN_NPC
    dispatch.hook('S_DESPAWN_NPC', 3, event => {
        let mobId = JSON.stringify(event.gameId)
        if (mobs[mobId]) delete mobs[mobId]
        if (currentActions[mobId]) delete currentActions[mobId]
    })

    // S_LOAD_TOPO
    dispatch.hook('S_LOAD_TOPO', 3, event => {
        if (zone != event.zone) {
            writeCache(cache)
            cache = {}
        }
        zone = event.zone
        mobs = []
        currentActions = []
    })

    // S_ACTION_STAGE
    dispatch.hook('S_ACTION_STAGE', 4, event => {
        let mobId = JSON.stringify(event.gameId),
            huntingZoneId = mobs[mobId],
            templateId = event.templateId,
            skill = parseInt('0x' + event.skill.toString(16).slice(-4))
        if (huntingZoneId) {
            if (config.debug) console.log(`sActionStage <- ${huntingZoneId} ${templateId} ${skill} ${event.stage}`)
            if (currentActions[mobId] && event.stage > currentActions[mobId].stage) {
                //if (config.debug) console.log(huntingZoneId, templateId, skill, JSON.stringify(currentActions[mobId]), Date.now())
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
                event.speed = event.speed * length / Math.max(length - ping.avg * event.speed, 1000/config.minCombatFPS)
                return true
            }
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
            if (event.type == 0) {
                if (!cache[huntingZoneId][templateId]) cache[huntingZoneId][templateId] = {}
                cache[huntingZoneId][templateId][skill] = cache[huntingZoneId][templateId][skill] ? (cache[huntingZoneId][templateId][skill] + time) / 2 : time
            }
            else {
                if (config.debug) console.log(huntingZoneId, templateId, skill, event.type, time)
            }
        }
    })

    // S_EXIT
    dispatch.hook('S_EXIT', 'raw', ()=>{
        writeCache(cache)
    })
}