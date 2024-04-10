function getPipHTML(name, value, hidden, cb_text = "") {
  return `<input type="radio" name="${name}" class="${
    hidden ? "rating-hidden" : "mask mask-circle"
  }" value=${value} ${cb_text.length == 0 ? "" : `onclick="${cb_text}"`} ${
    value == 0 ? "checked" : ""
  } />`
}

function getPipsHTML(id, max, pip_create_func = getPipHTML) {
  let inner = pip_create_func(id, 0, true)
  for (let i = 0; i < max; i++) {
    inner += "\n" + pip_create_func(id, i + 1)
  }
  inner += "\n" + pip_create_func(id, max, true)

  return `
<div class="rating gap-1 justify-center mt-1">
  ${inner}
</div>`
}

function getPipsValue(name) {
  return document.querySelector("input[name='" + name + "']:checked").value
}

function setPipsValue(name, val) {
  return (document.querySelector("input[name='" + name + "'][value='" + val + "']").checked = true)
}

/*
  Action Values
*/
export const Action = {}

function getActionName(act_id) {
  return "act-rating-" + act_id
}

function getActionValueHTML(act_id, value, hidden = false) {
  return getPipHTML(getActionName(act_id), value, hidden, `d6t.setActionValue(${act_id}, ${value})`)
}

function getActionRatingHTML(act_id, max) {
  return getPipsHTML(act_id, max, getActionValueHTML)
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
  <div class="flex flex-col" id="${getActionName(act_id)}"> ${button_text}${getActionRatingHTML(
    act_id,
    max
  )}
  </div>`
}

Action.getValue = function (act_id) {
  return getPipsValue(getActionName(act_id))
}

Action.setValue = function (act_id, val) {
  setPipsValue(getActionName(act_id), val)
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
  return `
<div class="label pb-1 pt-2 w-full">
  <span class="label-text w-full">${extra_lbl}</span>
</div>
<textarea spellcheck="false" onchange="d6t.applyToonBio('${extra_id}')" id="${getBioExtraID(
    extra_id
  )}" class="textarea textarea-bordered leading-normal h-24 p-0 w-full" placeholder="${extra_lbl}"></textarea>`
}

/*
  Toon Cond
*/
export const ToonCond = {}

function getCondValueName(cond_id) {
  return "cond-" + cond_id
}

function getCondTextName(cond_id) {
  return getCondValueName(cond_id) + "-text"
}

function getCondValueHTML(cond_id, value, hidden = false) {
  return getPipHTML(getCondValueName(cond_id), value, hidden, `d6t.applyCondValue(${cond_id})`)
}

function getCondRatingHTML(cond_id, max) {
  return getPipsHTML(cond_id, max, getCondValueHTML)
}

function getCondNumberElement(cond_id) {
  return document.getElementById(getCondValueName(cond_id))
}

ToonCond.getValue = function (cond_id) {
  let number_elm = getCondNumberElement(cond_id)
  return (number_elm && number_elm.value) ?? getPipsValue(getCondValueName(cond_id))
}

ToonCond.setValue = function (cond_id, value) {
  let number_elm = getCondNumberElement(cond_id)
  number_elm ? (number_elm.value = value) : setPipsValue(getCondValueName(cond_id), value)
}

ToonCond.getText = function (cond_id) {
  let elm = document.getElementById(getCondTextName(cond_id))
  return (elm && elm.value) ?? ""
}

ToonCond.setText = function (cond_id, text) {
  let elm = document.getElementById(getCondTextName(cond_id))
  if (elm) {
    elm.value = text
  }
}

ToonCond.getHTML = function (cond_id, cond_data) {
  return `
<div id="toon-cond-${cond_id}-par" class="grow">
  <div class="flex flex-${cond_data.text_default ? "row" : "col"} justify-center w-full">
    <div class="text-center">${cond_data.name}</div>${
    cond_data.max < 6
      ? getCondRatingHTML(cond_id, cond_data.max)
      : `
      <input type="number" onchange="d6t.applyCondValue(${cond_id})" min="0" max="${
          cond_data.max
        }" value="0" id="${getCondValueName(cond_id)}" class="w-full" />
      `
  }
  </div>${
    cond_data.text_default
      ? `
  <textarea
    spellcheck="false"
    id="${getCondTextName(cond_id)}"
    onchange="d6t.applyCondText('${cond_id}')"
    class="textarea textarea-bordered leading-none min-h-10 h-10 p-0 w-full"
    placeholder="${cond_data.text_default}"
  ></textarea>`
      : ""
  }
</div>`
}
