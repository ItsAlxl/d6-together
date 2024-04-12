class Player {
  id
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

  getExportData() {
    return {
      bio_name: this.bio_name,
      bio_extras: this.bio_extras,
      cond: this.cond,
      acts: this.acts,
    }
  }
}

export let game_config = {
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
  act_max: 4,
  bio_extras: ["LOOK", "BACKGROUND", "VICE/PURVEYOR"],
  cond: [
    {
      name: "Harm",
      max: 5,
      text: "Unharmed.",
    },
    {
      name: "Trauma",
      max: 4,
      text: "Unscarred.",
    },
    {
      name: "Stress",
      max: 9,
      push: 2,
      assist: 1,
    },
  ],
}

export const players = []
export const toons = []

export function syncPlayers(p) {
  players.length = p.length
  for (let i = 0; i < p.length; i++) {
    players[i] = new Player(p[i])
  }
}

export function syncToons(t) {
  toons.length = t.length
  for (let i = 0; i < t.length; i++) {
    toons[i] = new Toon(t[i])
  }
}

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

export function addPlayer(pdata = {}) {
  if (!pdata.hasOwnProperty("id")) pdata.id = getFirstFreeIdx(players)
  let p = new Player(pdata)
  setAtRoster(p, pdata.id, players)
  return p
}

export function deletePlayer(id) {
  for (let t of toons) {
    if (t.plr_id == id) {
      t.plr_id = 0
    }
  }
  players[id] = null
}

export function addToon(tdata = {}) {
  if (!tdata.hasOwnProperty("id")) tdata.id = getFirstFreeIdx(toons)
  if (!tdata.hasOwnProperty("plr_id")) tdata.plr_id = 0
  let t = new Toon(tdata)
  setAtRoster(t, tdata.id, toons)
  return t
}

export function deleteToon(id) {
  toons[id] = null
}

export function setToonBio(id, key, value) {
  toons[id].bio_extras[key] = value
}

export function setToonCondValue(id, key, value) {
  toons[id].cond[key].v = value
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

export function applyGameConfig(gc) {
  game_config = gc
  for (let t of toons) {
    if (t != null) {
      t.applyGameConfig()
    }
  }
}
