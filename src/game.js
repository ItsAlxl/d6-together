import * as DiceTray from "./dicetray.js"
import * as Components from "./components.js"
import * as Roster from "./roster.js"
import * as Multiplayer from "./multiplayer.js"

const PROMPT_MAP = {
  "pmt-arbitrary": {
    title: "Build Dice Pool",
    act: "Roll!",
    onApply: requestPoolRoll,
    onOpen: function () {
      createPlayerNudsHTML("pmt-arbitrary")
    },
  },
  "pmt-action": {
    getTitle: function () {
      return (
        Roster.getToonName(action_toon) +
        "\n" +
        Components.Action.getName(Roster.game_config.act_list[action_act_id])
      )
    },
    act: "Roll!",
    onApply: requestActionRoll,
    applyExtraData: function (data) {
      action_toon = data.toon_id
      action_act_id = data.act_id
    },
    onOpen: function () {
      document.getElementById("action-push").checked = false
      document.getElementById("action-assist").checked = false
      document.getElementById("action-bonus").value = 0

      Components.Prompt.labelActionCbox("push", "Not Pushing")
      Components.Prompt.labelActionCbox("assist", "Not Assisted")

      Components.Prompt.enableActionCbox(
        "push",
        Multiplayer.isHost() ||
          (Roster.isToonOwner(MY_PLR_ID, action_toon) &&
            Roster.toonCanAffordCost(action_toon, "push"))
      )
      updateAssistValidity()

      enableElement(document.getElementById("action-bonus"), isPlrPromptAuthority(MY_PLR_ID))
    },
  },
  "pmt-add": {
    title: "Add Dice",
    act: "Add!",
    onApply: requestAddDice,
    onOpen: function () {
      createPlayerNudsHTML("pmt-add")
    },
  },
  "pmt-reroll": {
    title: "Reroll Dice",
    act: "Reroll!",
    onApply: requestRerollDice,
  },
  "pmt-clear": {
    title: "Clear Dice",
    act: "Clear!",
    onApply: requestClearDice,
  },
}
const urlParams = new URLSearchParams(window.location.search)
const TOAST_DURATION_MS = 3000

let current_toon_id = -1
let current_prompt = ""
let prompt_owner = -1

let action_toon = -1
let action_act_id = -1
let action_assist_toon = -1

function generateSeed() {
  return Date.now() * Math.random()
}

function setVisible(e, v) {
  v ? e.classList.remove("hidden") : e.classList.add("hidden")
}

function isPlrArbitraryNudAuthority(plr_id, arb_owner) {
  return plr_id == arb_owner || Multiplayer.isHost(plr_id)
}

window.d6t.applyArbNud = function (prompt_id, plr_id) {
  Multiplayer.send(
    "syncArbNudVal",
    {
      id: plr_id,
      prompt: prompt_id,
      value: Components.Prompt.getArbitraryNudElement(prompt_id, plr_id).valueAsNumber,
    },
    Multiplayer.SEND_OTHERS
  )
}

Multiplayer.cb.syncArbNudVal = function (data, sender) {
  if (isPlrArbitraryNudAuthority(sender, data.id)) {
    Components.Prompt.getArbitraryNudElement(data.prompt, data.id).value = data.value
  }
}

function createPlayerNudsHTML(prompt_id) {
  let plist = ""
  for (let p of Roster.players) {
    if (p != null) {
      plist += Components.Prompt.getArbitraryNudHTML(
        prompt_id,
        p,
        isPlrArbitraryNudAuthority(MY_PLR_ID, p.id)
      )
    }
  }
  replaceChildHTML(document.getElementById(prompt_id), plist)
}

function buildArbitraryPool(prompt_id) {
  const pool = {}
  const elms = Components.Prompt.getAllArbitraryNudElements(prompt_id)
  for (let i = 0; i < elms.length; i++) {
    const v = elms[i].valueAsNumber
    if (v) pool[elms[i].getAttribute("data-d6t-arb-own")] = v
  }
  return pool
}

function requestPoolRoll() {
  Multiplayer.send(
    "syncPoolRoll",
    {
      pool: buildArbitraryPool("pmt-arbitrary"),
      seed: generateSeed(),
    },
    Multiplayer.SEND_ALL_FORCE_NET
  )
}

Multiplayer.cb.syncPoolRoll = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    closePromptLocally(false)
    DiceTray.poolRoll(sender, data.pool, data.seed)
  }
}

function requestAddDice() {
  Multiplayer.send(
    "syncAddDice",
    {
      pool: buildArbitraryPool("pmt-add"),
      seed: generateSeed(),
    },
    Multiplayer.SEND_ALL_FORCE_NET
  )
}

Multiplayer.cb.syncAddDice = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    closePromptLocally(false)
    DiceTray.addDice(data.pool, data.seed)
  }
}

function requestRerollDice() {
  Multiplayer.send("syncRerollDice", generateSeed(), Multiplayer.SEND_ALL_FORCE_NET)
}

Multiplayer.cb.syncRerollDice = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    closePromptLocally(false)
    DiceTray.reroll(data)
  }
}

function requestClearDice() {
  Multiplayer.send("syncClearDice", null, Multiplayer.SEND_ALL_FORCE_NET)
}

Multiplayer.cb.syncClearDice = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    DiceTray.clear()
    closePromptLocally(true)
  }
}

window.d6t.applyActionPush = function () {
  Multiplayer.send(
    "syncActionPush",
    document.getElementById("action-push").checked,
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncActionPush = function (data, sender) {
  if (isPlrToonAuthority(sender, action_toon)) {
    Components.Prompt.labelActionCbox("push", data ? "Pushing" : "Not Pushing")
    document.getElementById("action-push").checked = data
  }
}

addEventListener("roll_done", (e) => {
  Multiplayer.send("syncRollResult", e.detail.result, Multiplayer.SEND_ALL)
})

Multiplayer.cb.syncRollResult = function (data, sender) {
  if (
    (!Roster.hasPlayer(DiceTray.roll_boss_id) && Multiplayer.isHost(sender)) ||
    sender == DiceTray.roll_boss_id
  ) {
    DiceTray.showFinalResult(data)
    enableDiceControls(true)
  }
}

function enableDiceControls(e) {
  const ctls_par = document.getElementById("dice-ctls")
  for (let i = 0; i < ctls_par.children.length; i++) {
    const btn = ctls_par.children[i]
    if (btn.classList.contains("btn") && !btn.classList.contains("btn-error")) {
      enableElement(btn, e)
    }
  }
}

function getMyToonId() {
  return current_toon_id >= 0 && isPlrToonAuthority(MY_PLR_ID, current_toon_id)
    ? current_toon_id
    : Roster.findFirstOwnedToon(MY_PLR_ID)
}

function updateAssistValidity() {
  const my_toon = getMyToonId()
  Components.Prompt.enableActionCbox(
    "assist",
    action_assist_toon >= 0
      ? Multiplayer.isHost() || Roster.isToonOwner(MY_PLR_ID, action_assist_toon)
      : my_toon >= 0 &&
          my_toon != action_toon &&
          (Multiplayer.isHost() || Roster.toonCanAffordCost(my_toon, "assist"))
  )
}

window.d6t.applyActionAssist = function () {
  const data = { value: document.getElementById("action-assist").checked }
  data.toon = Multiplayer.isHost() && !data.value ? action_assist_toon : getMyToonId()

  Multiplayer.send("syncActionAssist", data, Multiplayer.SEND_ALL)
}

Multiplayer.cb.syncActionAssist = function (data, sender) {
  if (
    data.toon >= 0 &&
    isPlrToonAuthority(sender, data.toon) &&
    (action_assist_toon == -1 || action_assist_toon == data.toon)
  ) {
    action_assist_toon = data.value && data.toon != action_toon ? data.toon : -1

    Components.Prompt.labelActionCbox(
      "assist",
      action_assist_toon < 0
        ? "Not Assisted"
        : "Assisted by " + Roster.getToonName(action_assist_toon)
    )
    updateAssistValidity()
    document.getElementById("action-assist").checked = action_assist_toon >= 0
  }
}

window.d6t.applyActionBonus = function () {
  Multiplayer.send(
    "syncActionBonus",
    document.getElementById("action-bonus").valueAsNumber,
    Multiplayer.SEND_OTHERS
  )
}

Multiplayer.cb.syncActionBonus = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    document.getElementById("action-bonus").value = data
  }
}

function requestActionRoll() {
  const data = {
    value:
      Roster.getToonAct(action_toon, action_act_id) +
      document.getElementById("action-bonus").valueAsNumber,
    seed: generateSeed(),
  }
  if (action_assist_toon >= 0) {
    data.ass = action_assist_toon
  }
  if (document.getElementById("action-push").checked) {
    data.push = 1
  }

  Multiplayer.send("syncActionRoll", data, Multiplayer.SEND_ALL_FORCE_NET)
}

Multiplayer.cb.syncActionRoll = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    closePromptLocally(false)

    const boss_id = Roster.getToonOwner(action_toon)
    const pool = {
      [boss_id]: data.value + (data.push ?? 0),
    }
    if (data.push) {
      Roster.toonSpendCost(action_toon, "push")
    }
    if (data.ass != null) {
      pool[Roster.getToonOwner(data.ass)] = 1
      Roster.toonSpendCost(data.ass, "assist")
    }
    for (let i = 0; i < Roster.game_config.cond.length; i++) {
      refreshToonCondValue(i)
    }
    DiceTray.actionRoll(boss_id, pool, data.seed)

    action_toon = -1
    action_act_id = -1
    action_assist_toon = -1
  }
}

function isPlrPromptAuthority(plr_id) {
  return prompt_owner == plr_id || Multiplayer.isHost(plr_id) || prompt_owner < 0
}

window.d6t.applyPrompt = function () {
  if (PROMPT_MAP[current_prompt] != null) {
    PROMPT_MAP[current_prompt].onApply()
  }
  closePromptLocally(false)
}

function isPromptOpen(p) {
  return p == current_prompt
}

window.d6t.openPrompt = function (id, extra_data, allow_reopen = false) {
  if (allow_reopen ? isPlrPromptAuthority(MY_PLR_ID) : !isPromptOpen(id) && prompt_owner < 0) {
    const syncData = { id: id }
    if (extra_data) syncData.extra = extra_data
    Multiplayer.send("syncPromptOpen", syncData, Multiplayer.SEND_ALL)
  }
}

Multiplayer.cb.syncPromptOpen = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    const prompts_par = document.getElementById("prompt-list")
    current_prompt = data.id
    for (let i = 0; i < prompts_par.children.length; i++) {
      setVisible(prompts_par.children[i], prompts_par.children[i].id == data.id)
    }

    const pdata = PROMPT_MAP[current_prompt]
    if (pdata == null) {
      d6t.closePrompt()
    } else {
      prompt_owner = sender
      if (data.extra && pdata.applyExtraData) {
        pdata.applyExtraData(data.extra)
      }
      document.getElementById("prompt-title").innerText =
        (pdata.getTitle && pdata.getTitle()) ?? pdata.title ?? ""
      document.getElementById("prompt-confirm-btn").innerText = pdata.act ?? "Confirm"

      const controls = document.getElementById("prompt-controls").children
      for (let i = 0; i < controls.length; i++) {
        enableElement(controls[i], isPlrPromptAuthority(MY_PLR_ID))
      }
      if (pdata.onOpen) pdata.onOpen()
      setVisible(document.getElementById("prompt-bg"), true)
      enableDiceControls(false)
    }
  }
}

window.d6t.closePrompt = function () {
  Multiplayer.send("syncPromptClose", null, Multiplayer.SEND_ALL)
}

function closePromptLocally(dice_ctls) {
  prompt_owner = -1
  current_prompt = ""
  setVisible(document.getElementById("prompt-bg"), false)

  if (dice_ctls != null) {
    enableDiceControls(dice_ctls)
  }
}

Multiplayer.cb.syncPromptClose = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    closePromptLocally(DiceTray.isReady() ? true : null)
  }
}

window.d6t.onActionClicked = function (act_id) {
  if (isPromptOpen("pmt-arbitrary")) {
    document.querySelector('[data-d6t-arb-own="' + MY_PLR_ID + '"]').value = Roster.getToonAct(
      current_toon_id,
      act_id
    )
  } else {
    d6t.openPrompt(
      "pmt-action",
      { act_id: act_id, toon_id: current_toon_id },
      act_id != action_act_id || current_toon_id != action_toon
    )
  }
}

window.d6t.applyToonName = function () {
  Multiplayer.send(
    "syncToonName",
    {
      toon_id: current_toon_id,
      value: document.getElementById("toon-name").value,
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncToonName = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    if (data.value.length == 0) data.value = "Character"
    Roster.setToonName(data.toon_id, data.value)
    Components.ToonTab.applyName(Roster.toons[data.toon_id])
    if (sender != MY_PLR_ID) {
      refreshToonName(Roster.toons[data.toon_id])
    }
  }
}

window.d6t.applyToonBio = function (bio_id) {
  Multiplayer.send(
    "syncToonBio",
    {
      toon_id: current_toon_id,
      bio_id: bio_id,
      value: Components.ToonSheet.getBioExtraElement(bio_id).value,
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncToonBio = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    Roster.setToonBio(data.toon_id, data.bio_id, data.value)
    if (sender != MY_PLR_ID) {
      refreshToonBio(data.bio_id, Roster.toons[data.toon_id])
    }
  }
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
  Multiplayer.send("syncAddToon", Roster.addToon(), Multiplayer.SEND_OTHERS)
  updateToonTabs()
}

Multiplayer.cb.syncAddToon = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    Roster.addToon(data)
    updateToonTabs()
  }
}

window.d6t.deleteToon = function () {
  Multiplayer.send("syncDeleteToon", current_toon_id, Multiplayer.SEND_ALL)
}

Multiplayer.cb.syncDeleteToon = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    Roster.deleteToon(data)
    updateToonTabs()
  }
}

function makeClockAddRequest(data) {
  if (data.priv) {
    Multiplayer.cb.syncAddClock(data, MY_PLR_ID)
  } else {
    Multiplayer.send("syncAddClock", data, Multiplayer.SEND_ALL)
  }
}

window.d6t.addClock = function () {
  const data = {
    title: document.getElementById("clock-name").value,
    size: document.getElementById("clock-size").valueAsNumber,
  }
  if (document.getElementById("clock-priv").checked) data.priv = 1
  makeClockAddRequest(data)
}

Multiplayer.cb.syncAddClock = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    const list = document.getElementById(data.priv ? "clock-list-priv" : "clock-list-pub")
    list.insertAdjacentHTML(
      "beforeend",
      Components.Clock.getHTML(data.title, data.size, data.priv, data.value)
    )
    updateHostVis(list)
    window.lucide.refresh()
  }
}

function getClocksAggregate(priv) {
  const aggr = []
  const list = document.getElementById(priv ? "clock-list-priv" : "clock-list-pub")
  for (let i = 0; i < list.children.length; i++) {
    aggr.push(Components.Clock.getData(list.children[i]))
  }
  return aggr
}

function createClocksFromAggregate(aggr, priv) {
  let clocks_html = ""
  for (let i = 0; i < aggr.length; i++) {
    clocks_html += Components.Clock.getHTML(aggr[i].title, aggr[i].size, priv, aggr[i].value)
  }
  if (clocks_html.length > 0) {
    const list = document.getElementById(priv ? "clock-list-priv" : "clock-list-pub")
    list.insertAdjacentHTML("beforeend", clocks_html)

    updateHostVis(list)
    window.lucide.refresh()
  }
}

function isClockPublic(clock) {
  return clock.parentElement.id == "clock-list-pub"
}

function getPublicClock(idx) {
  return document.getElementById("clock-list-pub").children[idx]
}

function deleteClock(clock) {
  clock.remove()
}

function getElementIndex(elm) {
  return [...elm.parentElement.children].indexOf(elm)
}

function handleClockRemoval(clock) {
  if (isClockPublic(clock)) {
    Multiplayer.send("syncRemoveClock", getElementIndex(clock), Multiplayer.SEND_OTHERS)
  }
  deleteClock(clock)
}

window.d6t.removeClock = function (del_btn) {
  handleClockRemoval(Components.Clock.getFromPart(del_btn))
}

Multiplayer.cb.syncRemoveClock = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    deleteClock(getPublicClock(data))
  }
}

function setClockVal(clock, value) {
  Components.Clock.setValue(clock, value)
}

window.d6t.applyClockVal = function (nud) {
  const clock = Components.Clock.getFromPart(nud)
  if (isClockPublic(clock)) {
    Multiplayer.send(
      "syncClockValue",
      { idx: getElementIndex(clock), value: nud.valueAsNumber },
      Multiplayer.SEND_OTHERS
    )
  }
  setClockVal(clock, nud.valueAsNumber)
}

Multiplayer.cb.syncClockValue = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    setClockVal(getPublicClock(data.idx), data.value)
  }
}

window.d6t.toggleClockPrivacy = function (priv_button) {
  const clock = Components.Clock.getFromPart(priv_button)
  const clock_data = Components.Clock.getData(clock)
  if (isClockPublic(clock)) {
    clock_data.priv = 1
  } else {
    delete clock_data.priv
  }

  handleClockRemoval(clock)
  makeClockAddRequest(clock_data)
}

function replaceChildHTML(elm, replacement) {
  elm.innerHTML = replacement
}

function fillPlayerSelect(select_id) {
  let plist = ""
  for (let p of Roster.players) {
    if (p != null) {
      plist += Components.ToonSheet.getPlrOptionHTML(p)
    }
  }
  replaceChildHTML(document.getElementById(select_id), plist)
}

function updatePlayerList() {
  DiceTray.updatePlayerMats(Roster.players)
  fillPlayerSelect("toon-owner")
  refreshToonOwner()
}

function applyConfig(cfg) {
  if (Multiplayer.isConnected()) {
    Multiplayer.send("syncConfig", cfg, Multiplayer.SEND_ALL)
  } else {
    Multiplayer.cb.syncConfig(cfg, Multiplayer.HOST_SENDER_ID)
  }
}

Multiplayer.cb.syncConfig = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    Components.CfgMenu.takeConfig(data)
    Roster.applyGameConfig(data)

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

    refreshToonSheet()
  }
}

function refreshToonOwner(toon = Roster.toons[current_toon_id]) {
  if (toon != null && toon.id == current_toon_id) {
    document.getElementById("toon-owner").value = toon.plr_id
    enableToonSheetEditing(isPlrToonAuthority(MY_PLR_ID, toon.id))
  }
}

function refreshToonName(toon) {
  if (toon != null && toon.id == current_toon_id) {
    document.getElementById("toon-name").value = toon.bio_name
  }
}

function refreshToonAction(act_id, toon) {
  if (toon != null && toon.id == current_toon_id) {
    Components.Action.setValue(act_id, toon.acts[act_id])
  }
}

function refreshToonBio(bio_id, toon) {
  if (toon != null && toon.id == current_toon_id) {
    Components.ToonSheet.getBioExtraElement(bio_id).value = toon.bio_extras[bio_id]
  }
}

function refreshToonCondValue(cond_id, toon = Roster.toons[current_toon_id]) {
  if (toon != null && toon.id == current_toon_id) {
    Components.ToonCond.setValue(cond_id, Roster.getToonCondValue(toon.id, cond_id))
  }
}

function refreshToonCondText(cond_id, toon) {
  if (toon != null && toon.id == current_toon_id) {
    Components.ToonCond.setText(cond_id, toon.cond[cond_id].t ?? "")
  }
}

function enableElement(elm, enable) {
  enable ? elm.removeAttribute("disabled") : elm.setAttribute("disabled", true)
}

function enableToonSheetEditing(e) {
  const elms = document.getElementById("toon-sheet").querySelectorAll("input, textarea, button")
  for (let i = 0; i < elms.length; i++) {
    enableElement(elms[i], e)
  }
}

function refreshToonSheet() {
  const toon = Roster.toons[current_toon_id]
  if (toon != null && toon.id == current_toon_id) {
    for (let act_id in toon.acts) {
      refreshToonAction(act_id, toon)
    }
    for (let bio_id in toon.bio_extras) {
      refreshToonBio(bio_id, toon)
    }
    for (let cond_id in toon.cond) {
      refreshToonCondValue(cond_id, toon)
      refreshToonCondText(cond_id, toon)
    }
    refreshToonName(toon)
    refreshToonOwner(toon)
  }
}

window.d6t.selectToon = function (id, visual_reapply = false) {
  if (!visual_reapply && id == current_toon_id) {
    id = -1
  }

  if (id != current_toon_id && current_toon_id >= 0) {
    Components.ToonTab.setSelected(current_toon_id, false)
  }
  current_toon_id = parseInt(id)

  const valid_toon = Components.ToonTab.setSelected(id, true)
  if (!visual_reapply && valid_toon) {
    refreshToonSheet()
    updateAssistValidity()
  }
  setVisible(document.getElementById("toon-sheet"), valid_toon)

  if (!valid_toon) {
    current_toon_id = -1
  }
}

function isPlrToonAuthority(plr_id, toon_id) {
  return Roster.isToonOwner(plr_id, toon_id) || Multiplayer.isHost(plr_id)
}

window.d6t.setActionValue = function (act_id, value) {
  Multiplayer.send(
    "syncActionVal",
    {
      toon_id: current_toon_id,
      act_id: act_id,
      value: Roster.getToonAct(current_toon_id, act_id) == value ? 0 : value,
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncActionVal = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    Roster.setToonAct(data.toon_id, data.act_id, data.value)
    refreshToonAction(data.act_id, Roster.toons[data.toon_id])
  }
}

window.d6t.applyToonOwner = function () {
  Multiplayer.send(
    "syncToonOwner",
    {
      toon_id: current_toon_id,
      value: document.getElementById("toon-owner").value,
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncToonOwner = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    Roster.setToonOwner(data.toon_id, data.value)
    if (sender != MY_PLR_ID) {
      refreshToonOwner(Roster.toons[data.toon_id])
    }
  }
}

window.d6t.applyCondValue = function (cond_id) {
  const val = Components.ToonCond.getValue(cond_id)
  Multiplayer.send(
    "syncCondVal",
    {
      toon_id: current_toon_id,
      cond_id: cond_id,
      value: Roster.getToonCondValue(current_toon_id, cond_id) == val ? 0 : val,
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncCondVal = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    Roster.setToonCondValue(data.toon_id, data.cond_id, data.value)
    refreshToonCondValue(data.cond_id, Roster.toons[data.toon_id])
  }
}

window.d6t.applyCondText = function (cond_id) {
  Multiplayer.send(
    "syncCondText",
    {
      toon_id: current_toon_id,
      cond_id: cond_id,
      value: Components.ToonCond.getText(cond_id),
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncCondText = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    Roster.setToonCondText(data.toon_id, data.cond_id, data.value)
    if (sender != MY_PLR_ID) {
      refreshToonCondText(data.cond_id, Roster.toons[data.toon_id])
    }
  }
}

function showConfig(s) {
  setVisible(document.getElementById("view-tabletop"), !s)
  setVisible(document.getElementById("view-config"), s)
}

window.d6t.openConfig = function () {
  showConfig(true)
}

window.d6t.applyConfig = function () {
  applyConfig(Components.CfgMenu.buildConfig())
  showConfig(false)
}

window.d6t.cancelConfig = function () {
  showConfig(false)
}

window.d6t.cfgUpdateNumActs = function (nud) {
  Components.CfgMenu.setActionCount(nud.value)
}

window.d6t.cfgAddCond = function () {
  Components.CfgMenu.addCond()
}

window.d6t.cfgDeleteCond = function (button) {
  Components.CfgMenu.deleteCond(button)
}

Multiplayer.cb.syncToonImport = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    for (let i = 0; i < data.length; i++) {
      Roster.addToon(data[i])
    }
    updateToonTabs()
  }
}

Multiplayer.cb.syncClockAggr = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    createClocksFromAggregate(data)
  }
}

Multiplayer.cb.syncImport = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    Multiplayer.cb.syncConfig(data.cfg, sender)

    if (data.clocks) createClocksFromAggregate(data.clocks)

    if (data.toons) {
      for (let i = 0; i < data.toons.length; i++) {
        Roster.addToon(data.toons[i])
      }
      updateToonTabs()
    }
  }
}

function importJson(json_text) {
  const json_obj = JSON.parse(json_text)
  applyConfig(json_obj.cfg)

  if (json_obj.clocks_priv) {
    createClocksFromAggregate(json_obj.clocks_priv, true)
    delete json_obj.clocks_priv
  }
  Multiplayer.send("syncImport", json_obj, Multiplayer.SEND_ALL)
}

function getExportJson() {
  const exp_data = {
    cfg: Roster.game_config,
  }

  const toon_data = []
  for (let t of Roster.toons) {
    if (t != null) {
      toon_data.push(t.getExportData())
    }
  }
  if (toon_data.length > 0) exp_data.toons = toon_data

  const clocks_data = getClocksAggregate()
  if (clocks_data.length > 0) exp_data.clocks = clocks_data

  const clocks_priv_data = getClocksAggregate(true)
  if (clocks_priv_data.length > 0) exp_data.clocks_priv = clocks_priv_data

  return JSON.stringify(exp_data)
}

function showModalDlg(dlg, s) {
  s ? dlg.showModal() : dlg.close()
}

window.d6t.showImportDlg = function (s) {
  if (s) {
    document.getElementById("import-text").value = ""
  }
  showModalDlg(document.getElementById("modal-import"), s)
}

window.d6t.showInviteDlg = function (s) {
  showModalDlg(document.getElementById("modal-invite"), s)
}

window.d6t.processImport = function () {
  importJson(document.getElementById("import-text").value)
  window.d6t.showImportDlg(false)
}

window.d6t.showExportDlg = function (s) {
  if (s) {
    document.getElementById("export-text").value = getExportJson()
  }
  showModalDlg(document.getElementById("modal-export"), s)
}

function updateHostVis(root) {
  const host_elements = root.querySelectorAll("[data-d6t-host]")
  const is_host = String(Multiplayer.isHost())
  for (let i = 0; i < host_elements.length; i++) {
    setVisible(host_elements[i], host_elements[i].getAttribute("data-d6t-host") == is_host)
  }
}

function getProfData() {
  return {
    name: document.getElementById("prof-name").value,
    dice: {
      bg_id: document.getElementById("dice-bg-id").value,
      bg_clr: document.getElementById("dice-bg-clr").value,
      val_id: document.getElementById("dice-val-id").value,
      val_clr: document.getElementById("dice-val-clr").value,
    },
  }
}

window.d6t.joinRoom = function () {
  const room_code = document.getElementById("mp-room-code").value
  if (room_code.length >= 4) {
    Multiplayer.joinGame(room_code, getProfData())
  }
}

window.d6t.hostRoom = function () {
  Multiplayer.hostGame()
}

function finishLobbyTransition(tray_state) {
  DiceTray.updatePlayerMats(Roster.players)
  DiceTray.initialize(document.getElementById("dice-parent"), tray_state)
  showConfig(Multiplayer.isHost())
  setVisible(document.getElementById("view-join"), false)
}

Multiplayer.cb.hosted = function (data, sender) {
  if (sender == Multiplayer.SERVER_SENDER_ID) {
    MY_PLR_ID = 0
    Multiplayer.cb.crown(MY_PLR_ID, sender)

    Roster.addPlayer(getProfData())
    updatePlayerList()
    finishLobbyTransition()

    document.getElementById("invite-code").innerText = data.code

    const link_target = window.location.href + "?room=" + data.code
    const link_elm = document.getElementById("invite-link")
    link_elm.innerText = link_target
    link_elm.setAttribute("href", link_target)
  }
}

Multiplayer.cb.joiner = function (data, sender) {
  if (sender == Multiplayer.SERVER_SENDER_ID) {
    Multiplayer.send(
      "joined",
      {
        id: data.id,
        players: Roster.players,
        toons: Roster.toons,
        cfg: Roster.game_config,
        clocks: getClocksAggregate(),
        tray_state: DiceTray.getSyncState(),
      },
      data.id
    )

    data.prof.id = data.id
    const plr = Roster.addPlayer(data.prof)
    Multiplayer.send("syncPlrJoined", plr, Multiplayer.SEND_OTHERS)
    createToast(Components.Toast.getJoinerHTML(plr))
    updatePlayerList()
  }
}

Multiplayer.cb.joined = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    MY_PLR_ID = data.id
    Multiplayer.cb.syncConfig(data.cfg, sender)
    Roster.syncPlayers(data.players)
    Roster.syncToons(data.toons)
    createClocksFromAggregate(data.clocks)
    finishLobbyTransition(data.tray_state)
    updateToonTabs()
  }
}

Multiplayer.cb.syncPlrJoined = function (data, sender) {
  if (Multiplayer.isHost(sender)) {
    createToast(Components.Toast.getJoinerHTML(Roster.addPlayer(data)))
    updatePlayerList()
  }
}

Multiplayer.cb.leaver = function (data, sender) {
  if (sender == Multiplayer.SERVER_SENDER_ID) {
    createToast(Components.Toast.getLeaverHTML(Roster.players[data.id]))

    if (data.crown != null) Multiplayer.cb.crown(data.crown, sender)
    Roster.deletePlayer(data.id)
    updatePlayerList()
  }
}

Multiplayer.cb.crown = function (data, sender) {
  if (sender == Multiplayer.SERVER_SENDER_ID) {
    if (Roster.players[data]) createToast(Components.Toast.getCrownHTML(Roster.players[data]))

    Multiplayer.setHost(data)
    updateHostVis(document)
    enableElement(document.getElementById("toon-owner"), Multiplayer.isHost())
    refreshToonSheet()
  }
}

window.d6t.showRecrownDlg = function (s) {
  if (s) {
    fillPlayerSelect("recrown-select")
  }
  showModalDlg(document.getElementById("modal-recrown"), s)
}

window.d6t.requestRecrown = function () {
  Multiplayer.send(
    "crown",
    document.getElementById("recrown-select").value,
    Multiplayer.SEND_SERVER
  )
  window.d6t.showRecrownDlg(false)
}

function createToast(html) {
  const toast_par = document.getElementById("toast-par")
  toast_par.insertAdjacentHTML("beforeend", html)
  const toast = toast_par.lastChild
  setTimeout(() => d6t.clearToast(toast), TOAST_DURATION_MS)
}

window.d6t.showDisconnectAlert = function (s) {
  setVisible(document.getElementById("disconnect-alert"), s)
}

window.d6t.clearToast = function (toast) {
  if (toast) toast.remove()
}

window.d6t.getDiceImage = function (id) {
  return "/dice" + id + ".png"
}

class DicePreview {
  img
  tint = "#ffffff"
  ctx = null
  ready = false

  constructor(canvas, startUrl) {
    this.ctx = canvas.getContext("2d")
    this.setBaseImage(startUrl)
  }

  draw() {
    this.ctx.globalCompositeOperation = "copy"
    this.ctx.drawImage(this.img, 0, 0, 300, 200)
    this.ctx.globalCompositeOperation = "multiply"
    this.ctx.fillStyle = this.tint
    this.ctx.fillRect(0, 0, 300, 200)
    this.ctx.globalCompositeOperation = "destination-in"
    this.ctx.drawImage(this.img, 0, 0, 300, 200)
  }

  setBaseImage(url) {
    if (url && url.length > 0) {
      this.img = new Image()
      this.img.onload = () => {
        this.setTint(this.tint)
      }
      this.img.src = url
      this.draw()
    }
  }

  setTint(t) {
    this.tint = t
    this.draw()
  }
}
const DICE_PVW_BG = new DicePreview(document.getElementById("dice-pvw-bg"))
const DICE_PVW_VAL = new DicePreview(document.getElementById("dice-pvw-val"))

window.d6t.applyDicePvwImg = function (img_type) {
  ;(img_type == "bg" ? DICE_PVW_BG : DICE_PVW_VAL).setBaseImage(
    d6t.getDiceImage(document.getElementById("dice-" + img_type + "-id").value)
  )
}

window.d6t.applyDicePvwClr = function (img_type) {
  ;(img_type == "bg" ? DICE_PVW_BG : DICE_PVW_VAL).setTint(
    document.getElementById("dice-" + img_type + "-clr").value
  )
}

window.d6t.applyDicePvwImg("bg")
window.d6t.applyDicePvwImg("val")
window.d6t.applyDicePvwClr("bg")
window.d6t.applyDicePvwClr("val")

applyConfig(Roster.game_config)
document.getElementById("mp-room-code").value = urlParams.get("room") ?? ""
