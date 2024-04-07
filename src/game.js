import * as DiceTray from "./dicetray.js"

let my_pid = 1

function generateSeed() {
    return Date.now() * Math.random()
}

DiceTray.create(document.body)

window.requestPoolRoll = function(pool) {
    DiceTray.poolRoll(my_pid, pool, generateSeed())
}
