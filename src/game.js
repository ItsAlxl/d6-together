import * as DiceTray from "./dicetray.js"
import * as Components from "./components.js"
import * as Roster from "./roster.js"
import * as Multiplayer from "./multiplayer.js"

window.MY_PLR_ID = -1
window.d6t = {}

const PROMPT_MAP = {
  "pmt-arbitrary": {
    onApply: requestPoolRoll,
    onOpen: function () {
      let plist = ""
      for (let p of Roster.players) {
        if (p != null) {
          plist += Components.Prompt.getArbitraryNudHTML(
            p,
            isPlrArbitraryNudAuthority(MY_PLR_ID, p.id)
          )
        }
      }
      replaceChildHTML(document.getElementById("pmt-arbitrary"), plist)
    },
    title: "Build Pool",
    act: "Roll!",
  },
  "pmt-action": {
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
    getTitle: function () {
      return (
        Roster.getToonName(action_toon) +
        "\n" +
        Components.Action.getName(Roster.game_config.act_list[action_act_id])
      )
    },
    act: "Roll!",
  },
}
const urlParams = new URLSearchParams(window.location.search)

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
  return plr_id == arb_owner || plr_id == Multiplayer.HOST_SENDER_ID
}

window.d6t.applyArbNud = function (plr_id) {
  Multiplayer.send(
    "syncArbNudVal",
    {
      id: plr_id,
      value: Components.Prompt.getArbitraryNudElement(plr_id).valueAsNumber,
    },
    Multiplayer.SEND_OTHERS
  )
}

Multiplayer.cb.syncArbNudVal = function (data, sender) {
  if (isPlrArbitraryNudAuthority(sender, data.id)) {
    Components.Prompt.getArbitraryNudElement(data.id).value = data.value
  }
}

function requestPoolRoll() {
  const pool = {}
  const elms = Components.Prompt.getAllArbitraryNudElements()
  for (let i = 0; i < elms.length; i++) {
    let v = elms[i].valueAsNumber
    if (v) pool[elms[i].getAttribute("data-d6t-arb-own")] = v
  }

  Multiplayer.send(
    "syncPoolRoll",
    {
      pool: pool,
      seed: generateSeed(),
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncPoolRoll = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    DiceTray.poolRoll(sender, data.pool, data.seed)
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
  if (isPlrPromptAuthority(sender)) {
    Components.Prompt.labelActionCbox("push", data ? "Pushing" : "Not Pushing")
    document.getElementById("action-push").checked = data
  }
}

function getMyToonId() {
  return current_toon_id >= 0 && isPlrToonAuthority(MY_PLR_ID, current_toon_id)
    ? current_toon_id
    : Roster.findFirstOwnedToon(MY_PLR_ID)
}

function updateAssistValidity() {
  let my_toon = getMyToonId()
  Components.Prompt.enableActionCbox(
    "assist",
    action_assist_toon >= 0
      ? Multiplayer.isHost() || Roster.isToonOwner(MY_PLR_ID, action_assist_toon)
      : my_toon != action_toon &&
          (Multiplayer.isHost() || Roster.toonCanAffordCost(my_toon, "assist"))
  )
}

window.d6t.applyActionAssist = function () {
  let data = { value: document.getElementById("action-assist").checked }
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
  let data = {
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

  Multiplayer.send("syncActionRoll", data, Multiplayer.SEND_ALL)
}

Multiplayer.cb.syncActionRoll = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    let pool = {
      [Roster.getToonOwner(action_toon)]: data.value + (data.push ?? 0),
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
    DiceTray.actionRoll(sender, pool, data.seed)

    action_toon = -1
    action_act_id = -1
    action_assist_toon = -1
  }
}

function isPlrPromptAuthority(plr_id) {
  return prompt_owner == plr_id || plr_id == Multiplayer.HOST_SENDER_ID
}

window.d6t.applyPrompt = function () {
  if (PROMPT_MAP[current_prompt] != null) {
    PROMPT_MAP[current_prompt].onApply()
  }
  d6t.closePrompt()
}

function isPromptOpen(p) {
  return p == current_prompt
}

window.d6t.openPrompt = function (id, extra_data) {
  if (!isPromptOpen(id) && prompt_owner < 0) {
    let syncData = { id: id }
    if (extra_data) syncData.extra = extra_data
    Multiplayer.send("syncPromptOpen", syncData, Multiplayer.SEND_ALL)
  }
}

Multiplayer.cb.syncPromptOpen = function (data, sender) {
  if (prompt_owner < 0 || sender == prompt_owner) {
    let prompts_par = document.getElementById("prompt-list")
    current_prompt = data.id
    for (let i = 0; i < prompts_par.children.length; i++) {
      setVisible(prompts_par.children[i], prompts_par.children[i].id == data.id)
    }

    let pdata = PROMPT_MAP[current_prompt]
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
      pdata.onOpen()
      setVisible(document.getElementById("prompt-bg"), true)
    }
  }
}

window.d6t.closePrompt = function () {
  Multiplayer.send("syncPromptClose", null, Multiplayer.SEND_ALL)
}

Multiplayer.cb.syncPromptClose = function (data, sender) {
  if (isPlrPromptAuthority(sender)) {
    prompt_owner = -1
    current_prompt = ""
    setVisible(document.getElementById("prompt-bg"), false)
  }
}

window.d6t.onActionClicked = function (act_id) {
  if (isPromptOpen("pmt-arbitrary")) {
    document.getElementById("arb-mine").value = Roster.getToonAct(current_toon_id, act_id)
  } else {
    d6t.openPrompt("pmt-action", { act_id: act_id, toon_id: current_toon_id })
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
  if (sender == Multiplayer.HOST_SENDER_ID) {
    Roster.addToon(data)
    updateToonTabs()
  }
}

window.d6t.deleteToon = function () {
  Multiplayer.send("syncDeleteToon", current_toon_id, Multiplayer.SEND_ALL)
}

Multiplayer.cb.syncDeleteToon = function (data, sender) {
  if (sender == Multiplayer.HOST_SENDER_ID) {
    Roster.deleteToon(data)
    updateToonTabs()
  }
}

function replaceChildHTML(elm, replacement) {
  elm.innerHTML = replacement
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

function applyConfig(cfg) {
  if (Multiplayer.isConnected()) {
    Multiplayer.send("syncConfig", cfg, Multiplayer.SEND_ALL)
  } else {
    Multiplayer.cb.syncConfig(cfg, Multiplayer.HOST_SENDER_ID)
  }
}

Multiplayer.cb.syncConfig = function (data, sender) {
  if (sender == Multiplayer.HOST_SENDER_ID) {
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

    refreshToonOwner()
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
  let elms = document.getElementById("toon-sheet").querySelectorAll("input, textarea, button")
  for (let i = 0; i < elms.length; i++) {
    enableElement(elms[i], e)
  }
}

function refreshToonSheet(toon = Roster.toons[current_toon_id]) {
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

  let valid_toon = Components.ToonTab.setSelected(id, true)
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
  return Roster.isToonOwner(plr_id, toon_id) || plr_id == Multiplayer.HOST_SENDER_ID
}

window.d6t.setActionValue = function (act_id, value) {
  Multiplayer.send(
    "syncActionVal",
    {
      toon_id: current_toon_id,
      act_id: act_id,
      value: value,
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncActionVal = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    Roster.setToonAct(data.toon_id, data.act_id, data.value)
    if (sender != MY_PLR_ID) {
      refreshToonAction(data.act_id, Roster.toons[data.toon_id])
    }
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
  if (sender == Multiplayer.HOST_SENDER_ID) {
    Roster.setToonOwner(data.toon_id, data.value)
    if (sender != MY_PLR_ID) {
      refreshToonOwner(Roster.toons[data.toon_id])
    }
  }
}

window.d6t.applyCondValue = function (cond_id) {
  Multiplayer.send(
    "syncCondVal",
    {
      toon_id: current_toon_id,
      cond_id: cond_id,
      value: Components.ToonCond.getValue(cond_id),
    },
    Multiplayer.SEND_ALL
  )
}

Multiplayer.cb.syncCondVal = function (data, sender) {
  if (isPlrToonAuthority(sender, data.toon_id)) {
    Roster.setToonCondValue(data.toon_id, data.cond_id, data.value)
    if (sender != MY_PLR_ID) {
      refreshToonCondValue(data.cond_id, Roster.toons[data.toon_id])
    }
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

function importJson(json_text) {
  let json_obj = JSON.parse(json_text)
  applyConfig(json_obj.cfg)
  Multiplayer.send("syncToonImport", json_obj.toons, Multiplayer.SEND_ALL)
}

Multiplayer.cb.syncToonImport = function (data, sender) {
  if (sender == Multiplayer.HOST_SENDER_ID) {
    for (let i = 0; i < data.length; i++) {
      Roster.addToon(data[i])
    }
    updateToonTabs()
  }
}

function getExportJson() {
  let toon_data = []
  for (let t of Roster.toons) {
    if (t != null) {
      toon_data.push(t.getExportData())
    }
  }
  return JSON.stringify({
    cfg: Roster.game_config,
    toons: toon_data,
  })
}

function showModalDlg(dlg, s) {
  s ? dlg.showModal() : dlg.close()
}

window.d6t.showImportDlg = function (s) {
  showModalDlg(document.getElementById("modal-import"), s)
  if (s) {
    document.getElementById("import-text").value = ""
  }
}

window.d6t.showInviteDlg = function (s) {
  showModalDlg(document.getElementById("modal-invite"), s)
}

window.d6t.processImport = function () {
  importJson(document.getElementById("import-text").value)
  window.d6t.showImportDlg(false)
}

window.d6t.showExportDlg = function (s) {
  showModalDlg(document.getElementById("modal-export"), s)
  if (s) {
    document.getElementById("export-text").value = getExportJson()
  }
}

function updateHostVis() {
  let host_elements = document.querySelectorAll("[data-host-only]")
  let is_host = String(Multiplayer.isHost())
  for (let i = 0; i < host_elements.length; i++) {
    setVisible(host_elements[i], host_elements[i].getAttribute("data-host-only") == is_host)
  }
  enableElement(document.getElementById("toon-owner"), Multiplayer.isHost())
}

window.d6t.joinRoom = function () {
  let room_code = document.getElementById("mp-room-code").value
  if (room_code.length >= 4) {
    Multiplayer.joinGame(room_code, {
      name: document.getElementById("prof-name").value,
    })
  }
}

window.d6t.hostRoom = function () {
  Multiplayer.hostGame()
}

function finishLobbyTransition() {
  updateHostVis()
  setVisible(document.getElementById("view-join"), false)
  showConfig(Multiplayer.isHost())
  DiceTray.create(document.getElementById("dice-parent"))
}

Multiplayer.cb.hosted = function (data, sender) {
  if (sender == Multiplayer.SERVER_SENDER_ID) {
    MY_PLR_ID = Multiplayer.HOST_SENDER_ID
    Roster.addPlayer(
      {
        name: document.getElementById("prof-name").value,
      },
      Multiplayer.HOST_SENDER_ID
    )
    updatePlayerList()
    finishLobbyTransition()

    document.getElementById("invite-code").innerText = data.code

    let link_target = window.location.href + "?room=" + data.code
    let link_elm = document.getElementById("invite-link")
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
      },
      data.id
    )

    data.prof.id = data.id
    Multiplayer.send("syncPlrJoined", Roster.addPlayer(data.prof), Multiplayer.SEND_OTHERS)
    updatePlayerList()
  }
}

Multiplayer.cb.syncPlrJoined = function (data, sender) {
  if (sender == Multiplayer.HOST_SENDER_ID) {
    Roster.addPlayer(data)
    updatePlayerList()
  }
}

// TODO: host migration
Multiplayer.cb.leaver = function (data, sender) {
  if (sender == Multiplayer.SERVER_SENDER_ID) {
    Roster.deletePlayer(data.id)
    updatePlayerList()
  }
}

Multiplayer.cb.joined = function (data, sender) {
  if (sender == Multiplayer.HOST_SENDER_ID) {
    MY_PLR_ID = data.id
    Multiplayer.cb.syncConfig(data.cfg, sender)
    Roster.syncPlayers(data.players)
    Roster.syncToons(data.toons)
    finishLobbyTransition()
    updateToonTabs()
  }
}

applyConfig(Roster.game_config)
document.getElementById("mp-room-code").value = urlParams.get("room") ?? ""
