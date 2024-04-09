import * as DiceTray from "./dicetray.js"
import * as Components from "./components.js"
import * as Roster from "./roster.js"

window.d6t = {}

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

let current_toon_id = -1
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
    MY_PLR_ID,
    {
      [MY_PLR_ID]: document.getElementById("arb-mine").valueAsNumber,
      [2]: document.getElementById("arb-dbg").valueAsNumber,
    },
    generateSeed()
  )
}

function requestActionRool() {
  let pool = {
    [MY_PLR_ID]: action_value + (document.getElementById("action-push").checked ? 1 : 0),
  }
  if (action_assister >= 0) {
    pool[action_assister] = 1
  }
  DiceTray.actionRoll(MY_PLR_ID, pool, generateSeed())

  action_assister = -1
  action_value = -1
  document.getElementById("action-push").checked = false
  document.getElementById("action-assist").checked = false
}

window.d6t.applyPrompt = function () {
  if (PROMPT_MAP[current_prompt] != null) {
    PROMPT_MAP[current_prompt].cb()
  }
  d6t.closePrompt()
}

function isPromptOpen(p) {
  return p == current_prompt
}

window.d6t.openPrompt = function (id) {
  if (!isPromptOpen(id)) {
    let prompts_par = document.getElementById("prompt-list")
    current_prompt = id
    for (let i = 0; i < prompts_par.children.length; i++) {
      setVisible(prompts_par.children[i], prompts_par.children[i].id == id)
    }

    let pdata = PROMPT_MAP[current_prompt]
    if (pdata == null) {
      d6t.closePrompt()
    } else {
      document.getElementById("prompt-title").innerText = pdata.title
      document.getElementById("prompt-confirm-btn").innerText = pdata.act
      setVisible(document.getElementById("prompt-bg"), true)
    }
  }
}

window.d6t.closePrompt = function () {
  current_prompt = ""
  setVisible(document.getElementById("prompt-bg"), false)
}

window.d6t.onActionClicked = function (act_id) {
  let value = Components.getActionDisplayedValue(act_id)
  if (isPromptOpen("pmt-arbitrary")) {
    document.getElementById("arb-mine").valueAsNumber = value
  } else {
    action_value = parseInt(value)
    d6t.openPrompt("pmt-action")
  }
}

function updateToonTabs() {
  let tabs = ""
  for (let t of Roster.toons) {
    if (t != null) {
      tabs += Components.getToonTabHTML(t)
    }
  }
  document.getElementById("toon-tabs").innerHTML = tabs
  if (current_toon_id >= 0) {
    d6t.selectToon(current_toon_id, false)
  }
}

window.d6t.newToon = function () {
  Roster.addToon()
  updateToonTabs()
}

function updatePlayerList() {
  let plist = ""
  for (let p of Roster.players) {
    if (p != null) {
      plist += Components.getToonOwnerOptionHTML(p)
    }
  }
  document.getElementById("toon-owner").innerHTML = plist
  if (current_toon_id >= 0) {
    d6t.selectToon(current_toon_id, false)
  }
}

function refreshToonOwner() {
  let toon = Roster.toons[current_toon_id]
  if (toon != null) {
    console.log(toon.plr_id)
    document.getElementById("toon-owner").value = toon.plr_id
  }
}

function refreshToonSheet() {
  let toon = Roster.toons[current_toon_id]
  if (toon != null) {
    for (let act_id in toon.acts) {
      Components.setActionDisplayedValue(act_id, toon.acts[act_id])
    }
    refreshToonOwner()
  }
}

window.d6t.selectToon = function (id, allow_collapse = true) {
  if (allow_collapse && id == current_toon_id) {
    id = -1
  }

  if (id != current_toon_id && current_toon_id >= 0) {
    Components.setTabDisplaySelected(current_toon_id, false)
  }
  current_toon_id = id

  let valid_toon = Components.setTabDisplaySelected(id, true)
  if (valid_toon) {
    refreshToonSheet()
  }
  setVisible(document.getElementById("toon-sheet"), valid_toon)
}

window.d6t.setActionValue = function (act_id, value) {
  Roster.setToonAct(current_toon_id, parseInt(act_id), parseInt(value))
}

d6t.applyToonOwner = function () {
  Roster.setToonOwner(current_toon_id, parseInt(document.getElementById("toon-owner").value))
}

setVisible(document.getElementById("host-controls"), MY_NET_ID == 1)
DiceTray.create(document.getElementById("dice-parent"))

for (let i = 0; i < Roster.game_config.act_list.length; i++) {
  document
    .getElementById("toon-actions")
    .insertAdjacentHTML("beforeend", Components.getActionHTML(i, Roster.game_config.act_list[i], 3))
}
updatePlayerList()
