import * as DiceTray from "./dicetray.js"
window.MY_PLAYER_ID = 1

let Prompts = document.getElementById("prompt_bg")
function generateSeed() {
  return Date.now() * Math.random()
}

function setVisible(e, v) {
  v ? e.classList.remove("hidden") : e.classList.add("hidden")
}

DiceTray.create(document.getElementById("dice_par"))

window.requestPoolRoll = function () {
  closePrompt()
  DiceTray.poolRoll(
    MY_PLAYER_ID,
    { [MY_PLAYER_ID]: document.getElementById("pool_mine").valueAsNumber },
    generateSeed()
  )
}

window.openPrompt = function (id) {
  for (let i = 0; i < Prompts.children.length; i++) {
    setVisible(Prompts.children[i], Prompts.children[i].id == id)
  }
  setVisible(Prompts, true)
}

window.closePrompt = function () {
  setVisible(Prompts, false)
}
