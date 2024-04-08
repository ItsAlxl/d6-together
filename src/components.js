let component_helpers = {}

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
  <button class="btn btn-neutral btn-sm" onclick="onActionClicked(d6tComp.getActionValue('${act_id}'))">Action</button>
  <div class="rating gap-1">
    ${getActionRatingHTML(act_id, max)}
  </div>
</div>`
}

component_helpers.getActionValue = function (act_id) {
  return document.querySelector("input[name='" + getActionName(act_id) + "']:checked").value
}

component_helpers.setActionValue = function (act_id, val) {
  return document.querySelector("input[name='" + getActionName(act_id) + "'][value='" + val + "']").checked = true
}

window.d6tComp = component_helpers
