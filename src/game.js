import * as DiceTray from "./dicetray.js"

function generateSeed() {
    return Date.now() * Math.random()
}

DiceTray.create(document.getElementById("dice_par"))

window.requestPoolRoll = function(pool) {
    DiceTray.poolRoll(MY_PLAYER_ID, pool, generateSeed())
}
