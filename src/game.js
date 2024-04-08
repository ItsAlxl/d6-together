import * as DiceTray from "./dicetray.js"
window.MY_PLAYER_ID = 1

let Prompts = document.getElementById("prompt_bg")
let PromptControls = document.getElementById("prompt_controls")
let current_prompt = ""

function generateSeed() {
  return Date.now() * Math.random()
}

function setVisible(e, v) {
  v ? e.classList.remove("hidden") : e.classList.add("hidden")
}

DiceTray.create(document.getElementById("dice_par"))

function requestPoolRoll() {
  DiceTray.poolRoll(
    MY_PLAYER_ID,
    { [MY_PLAYER_ID]: document.getElementById("arb_mine").valueAsNumber },
    generateSeed()
  )
}

window.applyPrompt = function () {
  switch (current_prompt) {
    case "prompt_arbitrary":
      requestPoolRoll()
  }
  closePrompt()
}

window.openPrompt = function (id) {
  if (id != current_prompt) {
    current_prompt = id
    for (let i = 0; i < Prompts.children.length; i++) {
      setVisible(Prompts.children[i], Prompts.children[i].id == id)
      if (Prompts.children[i].id == id) {
        Prompts.children[i].appendChild(PromptControls)
      }
    }
    setVisible(Prompts, true)
  }
}

window.closePrompt = function () {
  current_prompt = ""
  setVisible(Prompts, false)
}
