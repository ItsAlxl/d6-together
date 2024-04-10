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
  let value = Components.Action.getValue(act_id)
  if (isPromptOpen("pmt-arbitrary")) {
    document.getElementById("arb-mine").valueAsNumber = value
  } else {
    action_value = parseInt(value)
    d6t.openPrompt("pmt-action")
  }
}

function setToonName(toon, name) {
  Roster.setToonName(toon.id, name)
  Components.ToonTab.applyName(Roster.toons[current_toon_id])
}

window.d6t.applyToonName = function () {
  setToonName(Roster.toons[current_toon_id], document.getElementById("toon-name").value)
}

window.d6t.applyToonBio = function (bio_id) {
  Roster.setToonBio(current_toon_id, bio_id, Components.ToonSheet.getBioExtraElement(bio_id).value)
}

function updateToonTabs() {
  let tabs = ""
  for (let t of Roster.toons) {
    if (t != null) {
      tabs += Components.ToonTab.getHTML(t)
    }
  }
  replaceChildHTML(document.getElementById("toon-tabs"), tabs)
  if (current_toon_id >= 0) {
    d6t.selectToon(current_toon_id, true)
  }
}

window.d6t.newToon = function () {
  Roster.addToon()
  updateToonTabs()
}

window.d6t.deleteToon = function () {
  if (current_toon_id >= 0) {
    Roster.deleteToon(current_toon_id)
    updateToonTabs()
  }
}

function replaceChildHTML(elm, replacement) {
  elm.replaceChildren()
  elm.insertAdjacentHTML("beforeend", replacement)
}

function updatePlayerList() {
  let plist = ""
  for (let p of Roster.players) {
    if (p != null) {
      plist += Components.ToonSheet.getPlrOptionHTML(p)
    }
  }
  replaceChildHTML(document.getElementById("toon-owner"), plist)
  refreshToonOwner()
}

function updateGameConfig() {
  Roster.updateGameConfig()

  let acts_html = ""
  for (let i = 0; i < Roster.game_config.act_list.length; i++) {
    acts_html += Components.Action.getHTML(
      i,
      Roster.game_config.act_list[i],
      Roster.game_config.act_max
    )
  }
  replaceChildHTML(document.getElementById("toon-actions"), acts_html)

  let bio_extras_html = ""
  for (let i = 0; i < Roster.game_config.bio_extras.length; i++) {
    bio_extras_html += Components.ToonSheet.getBioExtraHTML(i, Roster.game_config.bio_extras[i])
  }
  replaceChildHTML(document.getElementById("toon-bio-extras"), bio_extras_html)

  let conds_html = ""
  for (let i = 0; i < Roster.game_config.cond.length; i++) {
    conds_html += Components.ToonCond.getHTML(i, Roster.game_config.cond[i])
  }
  replaceChildHTML(document.getElementById("toon-cond"), conds_html)
}

function refreshToonOwner(toon = Roster.toons[current_toon_id]) {
  if (toon != null) {
    document.getElementById("toon-owner").value = toon.plr_id
  }
}

function refreshToonName(toon = Roster.toons[current_toon_id]) {
  if (toon != null) {
    document.getElementById("toon-name").value = toon.bio_name
  }
}

function refreshToonAction(act_id, toon = Roster.toons[current_toon_id]) {
  if (toon != null) {
    Components.Action.setValue(act_id, toon.acts[act_id])
  }
}

function refreshToonBio(bio_id, toon = Roster.toons[current_toon_id]) {
  if (toon != null) {
    Components.ToonSheet.getBioExtraElement(bio_id).value = toon.bio_extras[bio_id]
  }
}

function refreshToonCondValue(cond_id, toon = Roster.toons[current_toon_id]) {
  if (toon != null) {
    Components.ToonCond.setValue(cond_id, toon.cond[cond_id].v ?? 0)
  }
}

function refreshToonCondText(cond_id, toon = Roster.toons[current_toon_id]) {
  if (toon != null) {
    Components.ToonCond.setText(cond_id, toon.cond[cond_id].t ?? "")
  }
}

function refreshToonSheet() {
  let toon = Roster.toons[current_toon_id]
  if (toon != null) {
    for (let act_id in toon.acts) {
      refreshToonAction(act_id, toon)
    }
    for (let bio_id in toon.bio_extras) {
      refreshToonBio(bio_id, toon)
    }
    console.log(toon.cond)
    for (let cond_id in toon.cond) {
      refreshToonCondValue(cond_id, toon)
      refreshToonCondText(cond_id, toon)
    }
    refreshToonOwner(toon)
    refreshToonName(toon)
  }
}

window.d6t.selectToon = function (id, visual_reapply = false) {
  if (!visual_reapply && id == current_toon_id) {
    id = -1
  }

  if (id != current_toon_id && current_toon_id >= 0) {
    Components.ToonTab.setSelected(current_toon_id, false)
  }
  current_toon_id = id

  let valid_toon = Components.ToonTab.setSelected(id, true)
  if (!visual_reapply && valid_toon) {
    refreshToonSheet()
  }
  setVisible(document.getElementById("toon-sheet"), valid_toon)
}

window.d6t.setActionValue = function (act_id, value) {
  Roster.setToonAct(current_toon_id, parseInt(act_id), parseInt(value))
}

window.d6t.applyToonOwner = function () {
  Roster.setToonOwner(current_toon_id, parseInt(document.getElementById("toon-owner").value))
}

window.d6t.applyCondValue = function (cond_id) {
  Roster.setToonCondValue(current_toon_id, cond_id, Components.ToonCond.getValue(cond_id))
}

window.d6t.applyCondText = function (cond_id) {
  Roster.setToonCondText(current_toon_id, cond_id, Components.ToonCond.getText(cond_id))
}

function showConfig(s) {
  setVisible(document.getElementById("view-tabletop"), !s)
  setVisible(document.getElementById("view-config"), s)
}

window.d6t.openConfig = function () {
  showConfig(true)
}

window.d6t.applyConfig = function () {
  showConfig(false)
}

window.d6t.cancelConfig = function () {
  showConfig(false)
}

setVisible(document.getElementById("host-controls"), MY_NET_ID == 1)
DiceTray.create(document.getElementById("dice-parent"))

updatePlayerList()
showConfig(true)
updateGameConfig()