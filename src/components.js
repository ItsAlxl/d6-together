/*
  Generic Pips
*/

function getPipHTML(name, value, hidden, cb_text = "") {
  return `<input type="radio" name="${name}" class="${
    hidden ? "rating-hidden" : "mask mask-circle"
  }" value=${value} ${cb_text.length == 0 ? "" : `onclick="${cb_text}"`} ${
    value == 0 ? "checked" : ""
  } />`
}

function getPipsHTML(name, max, cb_text = "") {
  let inner = getPipHTML(name, 0, true, cb_text)
  for (let i = 0; i < max; i++) {
    inner += "\n" + getPipHTML(name, i + 1, false, cb_text)
  }
  inner += "\n" + getPipHTML(name, max, true, cb_text)

  return `
<div class="rating gap-1 justify-center mt-1">
  ${inner}
</div>`
}

function getPipsValue(name) {
  return document.querySelector("input[name='" + name + "']:checked").value
}

function setPipsValue(name, val) {
  const pip = document.querySelector("input[name='" + name + "'][value='" + val + "']")
  if (pip) pip.checked = true
}

function getPipsOrNudHTML(name, min, max, cb_text) {
  min = min ?? 0
  max = max ?? 0
  return max <= 6 && min == 0
    ? getPipsHTML(name, max, cb_text)
    : `
<input type="number" onchange="${cb_text}" min="${min}" max="${max}" value="0" id="${name}" class="w-full" />`
}

function getNumberElement(name) {
  return document.getElementById(name)
}

function getPipsOrNudValue(name) {
  const number_elm = getNumberElement(name)
  return parseInt((number_elm && number_elm.value) ?? getPipsValue(name))
}

function setPipsOrNudValue(name, value) {
  const number_elm = getNumberElement(name)
  number_elm ? (number_elm.value = value) : setPipsValue(name, value)
}

/*
  Action Values
*/
export const Action = {}

function getActionId(act_id) {
  return "act-rating-" + act_id
}

function getActionRatingHTML(act_id, min, max) {
  return getPipsOrNudHTML(getActionId(act_id), min, max, "d6t.applyActionValue(" + act_id + ")")
}

Action.getName = function (act_text) {
  const space_idx = act_text.indexOf(" ")
  return space_idx >= 0 ? act_text.substring(0, space_idx) : act_text
}

Action.getHTML = function (act_id, act_text, min, max) {
  const space_idx = act_text.indexOf(" ")
  // TODO: replace tooltips
  return `
<div class="flex flex-col">
  <button class="btn btn-neutral btn-sm w-full"${
    space_idx >= 0 ? ' title="' + act_text + '"' : ""
  } onclick="d6t.onActionClicked('${act_id}')">${
    space_idx >= 0 ? act_text.substring(0, space_idx) : act_text
  }</button>
  ${getActionRatingHTML(act_id, min, max)}
</div>`
}

Action.getValue = function (act_id) {
  return getPipsOrNudValue(getActionId(act_id))
}

Action.setValue = function (act_id, value) {
  setPipsOrNudValue(getActionId(act_id), value)
}

/*
  Toon Tabs
*/
export const ToonTab = {}

ToonTab.getHTML = function (toon) {
  return `<a role="tab" class="tab" data-d6t-toon-id="${toon.id}" onclick="d6t.selectToon('${toon.id}')">${toon.bio_name}</a>`
}

function getToonTab(toon_id) {
  return document.querySelector("#toon-tabs > .tab[data-d6t-toon-id='" + toon_id + "']")
}

ToonTab.setSelected = function (toon_id, sel) {
  const t = toon_id >= 0 ? getToonTab(toon_id) : null
  if (t == null) return false
  sel ? t.classList.add("tab-active") : t.classList.remove("tab-active")
  return true
}

ToonTab.applyName = function (toon) {
  getToonTab(toon.id).innerText = toon.bio_name
}

/*
  Toon Sheet
*/
export const ToonSheet = {}

ToonSheet.getPlrOptionHTML = function (plr) {
  return `<option value=${plr.id}>${plr.name}</option>`
}

function getBioExtraID(extra_id) {
  return "toon-bio-" + extra_id
}

ToonSheet.getBioExtraElement = function (extra_id) {
  return document.getElementById(getBioExtraID(extra_id))
}

ToonSheet.getBioExtraHTML = function (extra_id, extra_lbl) {
  const colon_idx = extra_lbl.indexOf(":")
  return `
<div class="label pb-1 pt-2 w-full">
  <span class="label-text w-full">${
    colon_idx >= 0 ? extra_lbl.substring(0, colon_idx) : extra_lbl
  }</span>
</div>
<textarea spellcheck="false" onchange="d6t.applyToonBio('${extra_id}')" id="${getBioExtraID(
    extra_id
  )}" class="textarea textarea-bordered leading-normal h-16 p-0 w-full""${
    colon_idx >= 0 ? ' placeholder="' + extra_lbl.substring(colon_idx + 1) + '"' : ""
  }></textarea>`
}

/*
  Resource
*/
export const Resource = {}

function getResourceValueName(rtype, rid) {
  return rtype + "-" + rid
}

function getResourceTextName(rtype, rid) {
  return getResourceValueName(rtype, rid) + "-text"
}

function getResourceRatingHTML(rtype, rid, min, max) {
  min = min ?? 0
  max = max ?? 0
  return max == 0 && min == 0
    ? ""
    : getPipsOrNudHTML(
        getResourceValueName(rtype, rid),
        min,
        max,
        "d6t.applyResourceValue('" + rtype + "'," + rid + ")"
      )
}

Resource.getValue = function (rtype, rid) {
  return getPipsOrNudValue(getResourceValueName(rtype, rid))
}

Resource.setValue = function (rtype, rid, value) {
  setPipsOrNudValue(getResourceValueName(rtype, rid), value)
}

Resource.getText = function (rtype, rid) {
  const elm = document.getElementById(getResourceTextName(rtype, rid))
  return (elm && elm.value) ?? ""
}

Resource.setText = function (rtype, rid, text) {
  const elm = document.getElementById(getResourceTextName(rtype, rid))
  if (elm) {
    elm.value = text
  }
}

Resource.getHTML = function (rtype, rid, res_data) {
  return `
<div class="grow">
  <div class="flex flex-${res_data.text ? "row" : "col"} justify-center w-full">
    <div class="text-center whitespace-nowrap">${res_data.name}</div>${getResourceRatingHTML(
    rtype,
    rid,
    res_data.min,
    res_data.max
  )}
  </div>${
    res_data.text
      ? `
  <textarea
    spellcheck="false"
    id="${getResourceTextName(rtype, rid)}"
    onchange="d6t.applyResourceText('${rtype}',${rid})"
    class="textarea textarea-bordered leading-none min-h-10 h-10 p-0 w-full"
    placeholder="${res_data.text}"
  ></textarea>`
      : ""
  }
</div>`
}

/*
  Prompts
*/
export const Prompt = {}

function getArbNudTag(key) {
  return "data-d6t-arb-own" + (key == null ? "" : '="' + key + '"')
}

Prompt.getArbitraryNudHTML = function (prompt_key, plr, editable) {
  return `<input type="number" min="0" max="10" value="0" ${getArbNudTag(plr.id)} ${
    editable ? "" : "disabled"
  } onchange="d6t.applyArbNud('${prompt_key}', '${plr.id}')"/>`
}

Prompt.getArbitraryNudElement = function (prompt_key, plr_id) {
  return document.getElementById(prompt_key).querySelector("[" + getArbNudTag(plr_id) + "]")
}

Prompt.getAllArbitraryNudElements = function (prompt_key) {
  return document.getElementById(prompt_key).querySelectorAll("[" + getArbNudTag() + "]")
}

Prompt.enableActionCbox = function (id, enable) {
  const elm = document.getElementById("action-" + id)
  const par = elm.parentNode
  if (enable) {
    par.classList.remove("cursor-not-allowed")
    par.classList.add("cursor-pointer")
    elm.removeAttribute("disabled")
  } else {
    par.classList.remove("cursor-pointer")
    par.classList.add("cursor-not-allowed")
    elm.setAttribute("disabled", true)
  }
}

Prompt.labelActionCbox = function (id, txt) {
  document.getElementById("action-" + id + "-lbl").innerText = txt
}

/*
  Toasts
*/
export const Toast = {}

function getToastHTML(text, type) {
  return `
<button
  class="btn ${type.length == 0 ? "" : "btn-" + type} btn-sm clearable-toast"
  onclick="d6t.clearToast(this)"
>
  ${text}
</button>`
}

Toast.getJoinerHTML = function (joiner_player) {
  return getToastHTML(joiner_player.name + " has joined", "success")
}

Toast.getLeaverHTML = function (leaver_player) {
  return getToastHTML(leaver_player.name + " has left", "warning")
}

Toast.getCrownHTML = function (new_host_plr) {
  return getToastHTML(new_host_plr.name + " is now the host", "info")
}

/*
  Clock
*/
export const Clock = {
  MIN_SIZE: 2,
  MAX_SIZE: 12,
  DEF_SIZE: 4,
}

function getClockTag(key) {
  return 'data-d6t-clock="' + key + '"'
}

Clock.getFromPart = function (part) {
  return part.closest("[" + getClockTag("root") + "]")
}

function getClockPart(clock_root, part_name) {
  return clock_root.querySelector("[" + getClockTag(part_name) + "]")
}

function fillClockSvgSegments(svg, num_segments) {
  for (let i = 0; i < svg.children.length; i++) {
    i < num_segments
      ? svg.children[i].removeAttribute("fill")
      : svg.children[i].setAttribute("fill", "transparent")
  }
}

Clock.setValue = function (clock_root, value) {
  fillClockSvgSegments(getClockPart(clock_root, "svg"), value)
  getClockPart(clock_root, "nud").value = value
}

Clock.getData = function (clock_root) {
  const nud = getClockPart(clock_root, "nud")
  return {
    title: getClockPart(clock_root, "label").innerText,
    size: nud.max,
    value: nud.valueAsNumber,
  }
}

function findNumberEnd(text) {
  const dot_idx = text.indexOf(".")
  for (let i = text.length - 1; i > dot_idx; i--) {
    if (text.charAt(i) != "0") return i + 1
  }
  return dot_idx
}

function shortenNumber(n) {
  const txt = n.toFixed(2)
  return txt.substring(0, findNumberEnd(txt))
}

function getSegmentSvg(r, cx, cy, sx, sy, ex, ey, filled) {
  return `<path d="M${cx} ${cy}L${sx} ${sy}A${r} ${r} 0 0 1 ${ex} ${ey}" ${
    filled ? "" : 'fill="transparent"'
  }></path>`
}

function getClockSvg(num_segments, value = 0, r = 60) {
  const buffered_r = r + 3
  const buffered2_r = 2 * buffered_r
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewbox", [0, 0, buffered2_r, buffered2_r].join(" "))
  svg.setAttribute("width", buffered2_r + "px")
  svg.setAttribute("height", buffered2_r + "px")
  svg.setAttribute("stroke-width", 2.5)
  svg.setAttribute("fill-opacity", 0.4)
  svg.classList.add("stroke-base-content")
  svg.classList.add("fill-base-content")

  const angle = (2 * Math.PI) / num_segments
  let paths = ""

  // sin for x, -cos for y to make it start at the top and turn clockwise
  let start_x = buffered_r
  let start_y = buffered_r - r
  for (let i = 0; i < num_segments; i++) {
    const end_x = buffered_r + r * Math.sin(angle * (i + 1))
    const end_y = buffered_r - r * Math.cos(angle * (i + 1))
    paths += getSegmentSvg(
      r,
      buffered_r,
      buffered_r,
      shortenNumber(start_x),
      shortenNumber(start_y),
      shortenNumber(end_x),
      shortenNumber(end_y),
      i < value
    )
    start_x = end_x
    start_y = end_y
  }
  return `
<svg
  ${getClockTag("svg")}
  viewbox="0 0 ${buffered2_r} ${buffered2_r}"
  width="${buffered2_r}px"
  height="${buffered2_r}px"
  stroke-width="2.5"
  fill-opacity="0.4"
  class="stroke-base-content fill-base-content"
>${paths}</svg>`
}

Clock.getHTML = function (title, num_segments, priv, value) {
  num_segments = num_segments
    ? Math.min(Clock.MAX_SIZE, Math.max(num_segments, Clock.MIN_SIZE))
    : Clock.DEF_SIZE
  value = value ?? 0
  return `
<div class="flex flex-col" ${getClockTag("root")}>
  <div ${getClockTag("label")} class="text-center">${
    title == null || title.length == 0 ? "Clock" : title
  }</div>
  ${getClockSvg(num_segments, value)}
  <div class="hidden flex flex-row justify-center" data-d6t-host="true">
    <button class="btn btn-square btn-lxs" onclick="d6t.removeClock(this)">
      <svg class="w-[75%] h-[75%]" data-lucide-late="trash"></svg>
    </button>
    <button
      class="btn btn-square btn-lxs"
      onclick="d6t.toggleClockPrivacy(this)"
    >
      <svg class="w-[75%] h-[75%]" data-lucide-late="eye${priv ? "-off" : ""}"></svg>
    </button>
    <input
      type="number"
      class="w-12"
      min="0"
      max="${num_segments}"
      value="${value}"
      ${getClockTag("nud")}
      onchange="d6t.applyClockVal(this)"
    />
  </div>
</div>`
}

/*
  ConfigMenu
*/
export const CfgMenu = {}

function getCfgTagEq(tag) {
  return 'data-d6t-cfg="' + tag + '"'
}

function findCfgAncestor(start, tag) {
  return start.closest("[" + getCfgTagEq(tag) + "]")
}

function findCfgDescendant(start, tag) {
  return start.querySelector("[" + getCfgTagEq(tag) + "]")
}

function getDefaultActName() {
  return "ACTION with example"
}

function getCfgActionHTML() {
  return `
<input type="text" class="input input-bordered" ${getCfgTagEq(
    "act"
  )} placeholder="${getDefaultActName()}" />`
}

function getCfgActListRoot() {
  return document.getElementById("config-acts")
}

CfgMenu.setActionCount = function (n) {
  const list_root = getCfgActListRoot()
  if (list_root.childElementCount == n) return

  let new_acts = ""
  for (let i = list_root.childElementCount; i < n; i++) {
    new_acts += getCfgActionHTML()
  }
  list_root.insertAdjacentHTML("beforeend", new_acts)

  while (list_root.childElementCount > n) {
    list_root.removeChild(list_root.lastElementChild)
  }
}

function takeCfgActs(act_list) {
  CfgMenu.setActionCount(act_list.length)
  document.getElementById("config-act-count").value = act_list.length

  const nodes = getCfgActListRoot().children
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].value = act_list[i] ?? ""
  }
}

function takeCfgActMin(act_min) {
  document.getElementById("config-act-min").value = act_min
}

function takeCfgActMax(act_max) {
  document.getElementById("config-act-max").value = act_max
}

function buildActList() {
  const nodes = getCfgActListRoot().children
  const act_list = []
  for (let i = 0; i < nodes.length; i++) {
    let s = nodes[i].value ?? ""
    if (s.length == 0) {
      s = getDefaultActName()
    }
    act_list.push(s)
  }
  return act_list
}

function getDefaultResourceName(rtype) {
  return rtype.toUpperCase()
}

function getResourceHTML(rtype) {
  return `
<div class="grid grid-cols-3 gap-1" ${getCfgTagEq(rtype)} >
  <div class="flex flex-row col-span-3 w-full">
    <input type="text" class="input input-bordered grow" ${getCfgTagEq(
      rtype + "-name"
    )} placeholder="${getDefaultResourceName(rtype)}" />
    <button class="btn btn-square btn-lxs" onclick="d6t.cfgDeleteResource('${rtype}', this)">
      <svg class="w-[75%] h-[75%]" data-lucide-late="trash"></svg>
    </button>
  </div>
  <textarea
    spellcheck="false"
    class="textarea textarea-bordered resize-none col-span-2 leading-relaxed"
    placeholder="<no text value>"
    ${getCfgTagEq(rtype + "-text")}
  ></textarea>
  <div class="flex flex-col items-end gap-1">
    <div>Min <input type="number" min="-100" max="100" value="0" class="w-14" ${getCfgTagEq(
      rtype + "-min"
    )} /></div>
    <div>Max <input type="number" min="-100" max="100" value="0" class="w-14" ${getCfgTagEq(
      rtype + "-max"
    )} /></div>
    <div>Push <input type="number" min="-100" max="100" value="0" class="w-14" ${getCfgTagEq(
      rtype + "-push"
    )} /></div>
    <div>Assist <input type="number" min="-100" max="100" value="0" class="w-14" ${getCfgTagEq(
      rtype + "-assist"
    )} /></div>
  </div>
</div>`
}

function getCfgResourceListRoot(rtype) {
  return document.getElementById("config-res-" + rtype)
}

CfgMenu.addResource = function (rtype, count = 1) {
  let html = ""
  for (let i = 0; i < count; i++) {
    html += getResourceHTML(rtype)
  }
  getCfgResourceListRoot(rtype).insertAdjacentHTML("beforeend", html)
  window.lucide.refresh()
}

CfgMenu.deleteResource = function (rtype, start_in) {
  findCfgAncestor(start_in, rtype).remove()
}

function setResourceString(rtype, res_root, res, key) {
  findCfgDescendant(res_root, rtype + "-" + key).value = res[key] ?? ""
}

function setResourceNumber(rtype, res_root, res, key) {
  findCfgDescendant(res_root, rtype + "-" + key).value = res[key] ?? 0
}

function takeCfgResources(rtype, res) {
  const list_root = getCfgResourceListRoot(rtype)
  if (list_root.childElementCount != res.length) {
    CfgMenu.addResource(rtype, res.length - list_root.childElementCount)
    while (list_root.childElementCount > res.length) {
      list_root.removeChild(list_root.lastElementChild)
    }
  }

  const res_elms = list_root.children
  for (let i = 0; i < res.length; i++) {
    setResourceString(rtype, res_elms[i], res[i], "name")
    setResourceString(rtype, res_elms[i], res[i], "text")
    setResourceNumber(rtype, res_elms[i], res[i], "min")
    setResourceNumber(rtype, res_elms[i], res[i], "max")
    setResourceNumber(rtype, res_elms[i], res[i], "push")
    setResourceNumber(rtype, res_elms[i], res[i], "assist")
  }
}

function addResourceString(rtype, res_root, res, key) {
  const s = findCfgDescendant(res_root, rtype + "-" + key).value ?? ""
  if (s.length > 0) {
    res[key] = s
  }
}

function addResourceNumber(rtype, res_root, res, key) {
  const v =
    Math.min(Math.max(findCfgDescendant(res_root, rtype + "-" + key).value, -100), 100) ?? 0
  if (v != 0) {
    res[key] = v
  }
}

function buildResource(rtype, res_root) {
  const res = {}
  addResourceString(rtype, res_root, res, "name")
  addResourceString(rtype, res_root, res, "text")
  addResourceNumber(rtype, res_root, res, "min")
  addResourceNumber(rtype, res_root, res, "max")
  addResourceNumber(rtype, res_root, res, "push")
  addResourceNumber(rtype, res_root, res, "assist")

  res.name = res.name ?? getDefaultResourceName(rtype)
  return res
}

function buildResourceList(rtype) {
  const nodes = getCfgResourceListRoot(rtype).children
  const res = []
  for (let i = 0; i < nodes.length; i++) {
    res.push(buildResource(rtype, nodes[i]))
  }
  return res
}

function takeCfgBio(bio) {
  document.getElementById("config-bio").value = bio.join("\n")
}

function buildBioList() {
  return document.getElementById("config-bio").value.split("\n")
}

CfgMenu.buildConfig = function () {
  return {
    act_list: buildActList(),
    act_min: document.getElementById("config-act-min").value,
    act_max: document.getElementById("config-act-max").value,
    bio_extras: buildBioList(),
    cond: buildResourceList("cond"),
    pool: buildResourceList("pool"),
  }
}

CfgMenu.takeConfig = function (cfg) {
  takeCfgActs(cfg.act_list ?? [])
  takeCfgActMin(cfg.act_min ?? 0)
  takeCfgActMax(cfg.act_max ?? 0)
  takeCfgBio(cfg.bio_extras ?? [])
  takeCfgResources("cond", cfg.cond ?? [])
  takeCfgResources("pool", cfg.pool ?? [])
}
