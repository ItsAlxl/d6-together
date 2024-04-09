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
  bio = {
    name: "Character",
  }
  acts = []

  constructor(tdata) {
    for (let key in tdata) {
      if (this.hasOwnProperty(key)) {
        this[key] = tdata[key]
      }
    }
  }
}

class GameConfig {
  bio_extras = []

  act_max = 4
  act_list = []

  stress_push = 2
  stress_assist = 1
  stress_max = 9
  stress_up = true
}

let players = []
let toons = []

window.MY_PLR_ID = -1
window.MY_NET_ID = 1 // TODO: relocate to mutliplayer.js

function setAtRoster(value, idx, array) {
  while (array.length < idx) {
    array.push(null)
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

function addPlayer(net_id, pdata = {}, idx = getFirstFreeIdx(players)) {
  pdata.id = idx
  pdata.net_owner = net_id
  setAtRoster(new Player(pdata), idx, players)
  if (players[idx].net_owner == MY_NET_ID) {
    MY_PLR_ID = idx
  }
}

function addToon(tdata = {}, idx = getFirstFreeIdx(toons)) {
  tdata.id = idx
  setAtRoster(new Toon(tdata), idx, toons)
}

function setToonBio(id, key, value) {
  toons[id].bio[key] = value
}

function setToonAct(id, key, value) {
  toons[id].acts[key] = value
}

// TODO: add host player when they create a room
addPlayer(MY_NET_ID, {
  name: "me :)",
})

export { players, toons, addToon, addPlayer, setToonAct, setToonBio }
