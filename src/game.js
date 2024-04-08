import * as DiceTray from "./dicetray.js"
import * as Components from "./components.js"
window.MY_PLAYER_ID = 1

const PROMPT_MAP = {
  "pmt-arbitrary": {
    cb: requestPoolRoll,
    title: "Build Pool",
    act: "Roll!",
  },
}

let current_prompt = ""

function generateSeed() {
  return Date.now() * Math.random()
}

function setVisible(e, v) {
  v ? e.classList.remove("hidden") : e.classList.add("hidden")
}

function requestPoolRoll() {
  DiceTray.poolRoll(
    MY_PLAYER_ID,
    {
      [MY_PLAYER_ID]: document.getElementById("arb_mine").valueAsNumber,
      [2]: document.getElementById("arb_dbg").valueAsNumber,
    },
    generateSeed()
  )
}

function requestActionRool(value) {
  DiceTray.actionRoll(MY_PLAYER_ID, {[MY_PLAYER_ID]: value}, generateSeed())
}

window.applyPrompt = function () {
  if (PROMPT_MAP[current_prompt] != null) {
    PROMPT_MAP[current_prompt].cb()
  }
  closePrompt()
}

window.openPrompt = function (id) {
  if (id != current_prompt) {
    let prompts_par = document.getElementById("prompt-list")
    current_prompt = id
    for (let i = 0; i < prompts_par.children.length; i++) {
      setVisible(prompts_par.children[i], prompts_par.children[i].id == id)
    }

    let pdata = PROMPT_MAP[current_prompt]
    if (pdata == null) {
      closePrompt()
    } else {
      document.getElementById("prompt-title").innerText = pdata.title
      document.getElementById("prompt-confirm-btn").innerText = pdata.act
      setVisible(document.getElementById("prompt-bg"), true)
    }
  }
}

window.closePrompt = function () {
  current_prompt = ""
  setVisible(document.getElementById("prompt-bg"), false)
}

window.onActionClicked = function(value) {
  requestActionRool(value)
}

DiceTray.create(document.getElementById("dice-parent"))
document.getElementById("char-sheet").insertAdjacentHTML("beforeend", Components.getActionHTML(0, 3))
