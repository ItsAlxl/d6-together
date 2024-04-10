/*
  Action Values
*/
export let Action = {}

function getActionName(act_id) {
  return "act-rating-" + act_id
}

function getActionValueHTML(act_id, value, hidden = false) {
  return `<input type="radio" name="${getActionName(act_id)}" class="${
    hidden ? "rating-hidden" : "mask mask-circle"
  }" value=${value} onclick="d6t.setActionValue('${act_id}', ${value})" ${
    value == 0 ? "checked" : ""
  } />`
}

function getActionRatingHTML(act_id, max) {
  let str = getActionValueHTML(act_id, 0, true)
  for (let i = 0; i < max; i++) {
    str += "\n" + getActionValueHTML(act_id, i + 1)
  }
  return str + "\n" + getActionValueHTML(act_id, max, true)
}

Action.getHTML = function (act_id, act_text, max) {
  let space_idx = act_text.indexOf(" ")
  let button_text = `
  <button class="btn btn-neutral btn-sm w-full" onclick="d6t.onActionClicked('${act_id}')">${
    space_idx >= 0 ? act_text.substring(0, space_idx) : act_text
  }</button>`
  if (space_idx >= 0) {
    button_text = `
    <div class="tooltip" data-tip="${act_text}">
      ${button_text}
    </div>`
  }
  return `
  <div class="flex flex-col" id="${getActionName(act_id)}"> ${button_text}
    <div class="rating gap-1 justify-center mt-1">
      ${getActionRatingHTML(act_id, max)}
    </div>
  </div>`
}

Action.getValue = function (act_id) {
  return document.querySelector("input[name='" + getActionName(act_id) + "']:checked").value
}

Action.setValue = function (act_id, val) {
  return (document.querySelector(
    "input[name='" + getActionName(act_id) + "'][value='" + val + "']"
  ).checked = true)
}

/*
  Toon Tabs
*/
export let ToonTab = {}

ToonTab.getHTML = function (toon) {
  return `<a role="tab" class="tab" data-d6t-toon-id="${toon.id}" onclick="d6t.selectToon('${toon.id}')">${toon.bio_name}</a>`
}

function getToonTab(toon_id) {
  return document.querySelector("#toon-tabs > .tab[data-d6t-toon-id='" + toon_id + "']")
}

ToonTab.setSelected = function (toon_id, sel) {
  let t = toon_id >= 0 ? getToonTab(toon_id) : null
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
export let ToonSheet = {}

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
  return `
<div class="label pb-1 pt-2 w-full">
  <span class="label-text w-full">${extra_lbl}</span>
</div>
<textarea onchange="d6t.applyToonBio('${extra_id}')" id="${getBioExtraID(
    extra_id
  )}" class="textarea textarea-bordered h-24 p-0 w-full" placeholder="${extra_lbl}"></textarea>`
}
