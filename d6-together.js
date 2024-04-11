// Open up the server

const PORT = 6462
const ws = require("ws")
const wss = new ws.Server({
  server: require("connect")()
    .use(require("serve-static")(__dirname + "/dist"))
    .listen(PORT, () => console.log("d6 Together open on port :" + PORT)),
})

// Everything else lol

const ROOMCODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
let wsocks = []
let rooms = []

function getFirstFreeIdx(arr) {
  for (let i in arr) if (arr[i] == null) return i
  return arr.length
}

function registerInArray(arr, val) {
  let idx = getFirstFreeIdx(arr)
  if (arr.length == idx) {
    arr.push(val)
  } else {
    arr[idx] = val
  }
  return idx
}

function registerWs(ws) {
  let idx = registerInArray(wsocks, ws)
  ws.d6t = {
    idx: idx,
  }
}

function generateRoomCode(len) {
  let c = ""
  for (let i = 0; i < len; i++) {
    c += ROOMCODE_CHARSET.charAt(Math.floor(Math.random() * ROOMCODE_CHARSET.length))
  }
  return c
}

function registerRoom(host_ws) {
  let r = {
    host: host_ws,
    plrs: [],
  }

  let code_len = 5
  do {
    r.code = generateRoomCode(code_len)
    code_len += 0.25
  } while (findRoom(r.code) >= 0)

  let idx = registerInArray(rooms, r)
  r.idx = idx
  addSockToRoom(host_ws, r)
  return r
}

function findRoom(code) {
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].code == code) return i
  }
  return -1
}

function addSockToRoom(ws, room) {
  ws.d6t_room = room
  ws.d6t_room_id = room.plrs.length
  room.plrs.push(ws)
}

function send(ws, key, data, sender = -1) {
  if (!ws) return
  let o = { k: key, s: sender }
  if (data) o.d = data
  ws.send(JSON.stringify(o))
}

function untrackWs(ws) {
  ws.d6t_room.plrs[ws.d6t_room_id] = null
  wsocks[ws.d6t_idx] = null
  send(ws.d6t_room.host, "leaver", { id: ws.d6t_room_id })
}

wss.on("connection", function connection(ws) {
  registerWs(ws)

  ws.on("error", console.error)
  ws.on("close", function (code, reason) {
    untrackWs(ws)
  })

  ws.on("message", function message(mtxt, isBinary) {
    let msg = JSON.parse(mtxt)
    if (!msg || !msg.k) return
    if (msg.t) {
      let room = ws.d6t_room
      if (msg.t >= 0) {
        send(room.plrs[msg.t], msg.k, msg.d, ws.d6t_room_id)
      } else {
        for (let i = 0; i < room.plrs.length; i++) {
          if (msg.t == -1 || i != ws.d6t_room_id) {
            send(room.plrs[i], msg.k, msg.d, ws.d6t_room_id)
          }
        }
      }
      return
    }

    switch (msg.k) {
      case "host":
        let hosted_room = registerRoom(ws)
        send(ws, "hosted", { code: hosted_room.code })
        break
      case "join":
        let join_idx = findRoom(msg.d.code)
        if (join_idx >= 0) {
          addSockToRoom(ws, rooms[join_idx])
          send(rooms[join_idx].host, "joiner", {
            id: ws.d6t_room_id,
            prof: msg.d.prof,
          })
        }
        break
    }
  })
})
