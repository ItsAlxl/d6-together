class Player {
  id
  net_owner
  name

  constructor(pdata) {
    for (let key in pdata) {
      if (this.hasOwnProperty(key)) {
        this[key] = pdata[key]
      }
    }
  }
}

class Toon {
  id
  plr_id
  bio_name = "Character"
  bio_extras = []
  cond = []
  acts = []

  constructor(tdata) {
    for (let key in tdata) {
      if (this.hasOwnProperty(key)) {
        this[key] = tdata[key]
      }
    }
    this.applyGameConfig()
  }

  applyGameConfig() {
    resizeArray(this.acts, game_config.act_list.length, 0)
    resizeArray(this.bio_extras, game_config.bio_extras.length, "")

    while (this.cond.length < game_config.cond.length) {
      this.cond.push({})
    }
    this.cond.length = game_config.cond.length
  }
}

export let game_config = {
  bio_extras: ["LOOK", "BACKGROUND", "VICE/PURVEYOR"],
  act_max: 4,
  act_list: [
    "HUNT a target",
    "FINESSE with precision",
    "ATTUNE your mind",
    "STUDY the details",
    "PROWL quietly",
    "COMMAND obedience",
    "SURVEY your surroundings",
    "SKIRMISH with hostiles",
    "CONSORT with acquaintances",
    "TINKER with mechanisms",
    "WRECK with brute force",
    "SWAY someone's thinking",
  ],
  cond: [
    {
      name: "Harm",
      max: 5,
      text: true,
      text_default: "Unharmed.",
    },
    {
      name: "Trauma",
      max: 4,
      text: true,
      text_default: "Unscarred.",
    },
    {
      name: "Stress",
      max: 9,
      cost_push: 2,
      cost_assist: 1,
      cost_sign: 1,
    },
  ],
}

export const players = []
export const toons = []

window.MY_PLR_ID = -1
window.MY_NET_ID = 1 // TODO: relocate to mutliplayer.js

function resizeArray(array, new_length, fill_value) {
  let prev_length = array.length
  array.length = new_length
  if (prev_length < new_length) {
    array.fill(fill_value, prev_length)
  }
}

function setAtRoster(value, idx, array) {
  if (array.length < idx) {
    resizeArray(array, idx, null)
  }
  if (array.length == idx) {
    array.push(value)
  } else {
    array[idx] = value
  }
}

function getFirstFreeIdx(array) {
  for (let i in array) if (array[i] == null) return i
  return array.length
}

export function addPlayer(net_id, pdata = {}, idx = getFirstFreeIdx(players)) {
  pdata.id = idx
  pdata.net_owner = net_id
  setAtRoster(new Player(pdata), idx, players)
  if (players[idx].net_owner == MY_NET_ID) {
    MY_PLR_ID = idx
  }
}

export function deletePlayer(id) {
  for (let t of toons) {
    if (t.plr_id == id) {
      t.plr_id = 0
    }
  }
  players[id] = null
}

export function addToon(tdata = {}, idx = getFirstFreeIdx(toons)) {
  tdata.id = idx
  if (!tdata.hasOwnProperty("plr_id")) {
    tdata.plr_id = 0
  }
  setAtRoster(new Toon(tdata), idx, toons)
}

export function deleteToon(id) {
  toons[id] = null
}

export function setToonBio(id, key, value) {
  toons[id].bio_extras[key] = value
}

export function setToonCondValue(id, key, value) {
  console.log("%d %d %d", id, key, value)
  toons[id].cond[key].v = value
  console.log(toons[id].cond)
}

export function setToonCondText(id, key, text) {
  toons[id].cond[key].t = text
}

export function setToonAct(id, key, value) {
  toons[id].acts[key] = value
}

export function setToonOwner(id, plr_id) {
  toons[id].plr_id = plr_id
}

export function setToonName(id, name) {
  toons[id].bio_name = name
}

export function updateGameConfig() {
  for (let t of toons) {
    t.applyGameConfig()
  }
}

// TODO: add host player when they create a room
addPlayer(MY_NET_ID, {
  name: "me :)",
})
// TODO: add other players when they join
addPlayer(2 * MY_NET_ID, {
  name: "friend c:",
})
