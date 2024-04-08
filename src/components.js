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
<div class="flex flex-col">
  <button class="btn btn-sm" onclick="onActionClicked(d6tComp.getActionValue('${act_id}'))">Action</button>
  <div class="rating gap-1">
    ${getActionRatingHTML(act_id, max)}
  </div>
</div>`
}

component_helpers.getActionValue = function (act_id) {
  return document.querySelector("input[name='" + getActionName(act_id) + "']:checked").value
}

window.d6tComp = component_helpers
