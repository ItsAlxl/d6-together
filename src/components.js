/*
  Action Values
*/

function getActionName(act_id) {
  return "act-rating-" + act_id
}

function getActionValueHTML(act_id, value, hidden = false) {
  return `<input type="radio" name="${getActionName(act_id)}" class="${
    hidden ? "rating-hidden" : "mask mask-circle"
  }" value=${value} ${value == 0 ? "checked" : ""} />`
}

function getActionRatingHTML(act_id, max) {
  let str = getActionValueHTML(act_id, 0, true)
  for (let i = 0; i < max; i++) {
    str += "\n" + getActionValueHTML(act_id, i + 1)
  }
  return str + "\n" + getActionValueHTML(act_id, max, true)
}

export function getActionHTML(act_id, max) {
  return `
<div class="flex flex-col" id="${getActionName(act_id)}">
  <button class="btn btn-neutral btn-sm" onclick="d6t.onActionClicked(d6t.getActionValue('${act_id}'))">Action</button>
  <div class="rating gap-1 justify-center mt-1">
    ${getActionRatingHTML(act_id, max)}
  </div>
</div>`
}

export function getActionValue(act_id) {
  return document.querySelector("input[name='" + getActionName(act_id) + "']:checked").value
}

export function setActionValue(act_id, val) {
  return (document.querySelector(
    "input[name='" + getActionName(act_id) + "'][value='" + val + "']"
  ).checked = true)
}

/*
  Toon Tabs
*/

export function getToonTabHTML(toon) {
  return `<a role="tab" class="tab" data-d6t-toon-id="${toon.id}" onclick="d6t.selectToon('${toon.id}')">${toon.bio.name}</a>`
}

export function getToonTab(toon_id) {
  return document.querySelector("#toon-tabs > .tab[data-d6t-toon-id='" + toon_id + "']")
}

export function setTabSelected(toon_id, sel) {
  sel
    ? getToonTab(toon_id).classList.add("tab-active")
    : getToonTab(toon_id).classList.remove("tab-active")
}
