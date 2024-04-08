import * as DiceTray from "./dicetray.js"
import * as Components from "./components.js"
window.MY_PLAYER_ID = 1

const PROMPT_MAP = {
  "pmt-arbitrary": {
    cb: requestPoolRoll,
    title: "Build Pool",
    act: "Roll!",
  },
  "pmt-action": {
    cb: requestActionRool,
    title: "Action Roll",
    act: "Roll!",
  },
}

let current_prompt = ""
let action_value = -1
let action_assister = -1

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
      [MY_PLAYER_ID]: document.getElementById("arb-mine").valueAsNumber,
      [2]: document.getElementById("arb-dbg").valueAsNumber,
    },
    generateSeed()
  )
}

function requestActionRool() {
  let pool = {
    [MY_PLAYER_ID]: action_value + (document.getElementById("action-push").checked ? 1 : 0),
  }
  if (action_assister >= 0) {
    pool[action_assister] = 1
  }
  DiceTray.actionRoll(MY_PLAYER_ID, pool, generateSeed())

  action_assister = -1
  action_value = -1
  document.getElementById("action-push").checked = false
  document.getElementById("action-assist").checked = false
}

window.applyPrompt = function () {
  if (PROMPT_MAP[current_prompt] != null) {
    PROMPT_MAP[current_prompt].cb()
  }
  closePrompt()
}

function isPromptOpen(p) {
  return p == current_prompt
}

window.openPrompt = function (id) {
  if (!isPromptOpen(id)) {
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

window.onActionClicked = function (value) {
  if (isPromptOpen("pmt-arbitrary")) {
    document.getElementById("arb-mine").valueAsNumber = value
  } else {
    action_value = parseInt(value)
    openPrompt("pmt-action")
  }
}

DiceTray.create(document.getElementById("dice-parent"))
document
  .getElementById("char-sheet")
  .insertAdjacentHTML("beforeend", Components.getActionHTML(0, 3))
