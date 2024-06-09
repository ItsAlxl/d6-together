// Server configuration

const PORT = 6462
const REJECT_HOST_ORIGIN_DIFF = true

function allowOrigin(origin) {
  return true
}

// Open up the server

const ws = require("ws")
const server = require("connect")()
  .use(require("serve-static")(__dirname + "/dist"))
  .listen(PORT, () => console.log("d6 Together open on :" + PORT))
const wss = new ws.Server({ noServer: true })

function onSocketError(err) {
  console.error(err)
}

server.on("upgrade", function (request, socket, head) {
  socket.on("error", onSocketError)

  if (
    (!REJECT_HOST_ORIGIN_DIFF ||
      request.headers.origin.replace(/(^\w+:|^)\/\//, "") == request.headers.host) &&
    allowOrigin(request.headers.origin)
  ) {
    socket.removeListener("error", onSocketError)

    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request)
    })
  } else {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
    socket.destroy()
  }
})

// Everything else lol

const ROOMCODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
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
    if (rooms[i] != null && rooms[i].code == code) return i
  }
  return -1
}

function addSockToRoom(ws, room) {
  ws.d6t_room = room
  ws.d6t_room_id = registerInArray(room.plrs, ws)
}

function findReplacementHostIdx(room) {
  for (let i = 0; i < room.plrs.length; i++) {
    if (room.plrs[i] != null && room.plrs[i] != room.host) return i
  }
  return -1
}

function switchRoomHost(room, to_idx = -1) {
  to_idx = to_idx >= 0 ? to_idx : findReplacementHostIdx(room)
  if (to_idx < 0 || to_idx >= room.plrs.length || room.plrs[to_idx] == null) {
    untrackRoom(room)
  } else {
    room.host = room.plrs[to_idx]
  }
  return to_idx
}

function send(ws, key, data, sender = -1) {
  if (!ws) return
  let o = { k: key, s: sender }
  if (data != null) o.d = data
  ws.send(JSON.stringify(o))
}

function sendToRoom(room, key, data, sender = -1, incl_sender = false) {
  for (let i = 0; i < room.plrs.length; i++) {
    if ((incl_sender || i != sender) && room.plrs[i] != null) {
      send(room.plrs[i], key, data, sender)
    }
  }
}

function untrackWs(ws) {
  if (ws.d6t_room != null) {
    ws.d6t_room.plrs[ws.d6t_room_id] = null

    const newHostIdx = ws.d6t_room.host == ws ? switchRoomHost(ws.d6t_room) : null
    if (newHostIdx == null || newHostIdx >= 0) {
      const data = { id: ws.d6t_room_id }
      if (newHostIdx != null) data.crown = newHostIdx
      sendToRoom(ws.d6t_room, "leaver", data)
    }
  }
}

function untrackRoom(room) {
  for (let i = 0; i < room.plrs.length; i++) {
    if (room.plrs[i] != null) {
      room.plrs[i].d6t_room = null
      room.plrs[i].terminate()
    }
  }
  rooms[room.idx] = null
}

function missingComps(msg, comps) {
  if (comps.length > 0 && msg.d == null) {
    return true
  }
  for (let i = 0; i < comps.length; i++) {
    if (msg.d[comps[i]] == null) return true
  }
  return false
}

wss.on("connection", function connection(ws, req) {
  ws.on("error", onSocketError)
  ws.on("close", function (code, reason) {
    untrackWs(ws)
  })

  ws.on("message", function message(mtxt, isBinary) {
    let msg = JSON.parse(mtxt)
    if (!msg || msg.k == null) return
    if (msg.t != null) {
      let room = ws.d6t_room
      if (msg.t >= 0) {
        send(room.plrs[msg.t], msg.k, msg.d, ws.d6t_room_id)
      } else {
        sendToRoom(room, msg.k, msg.d, ws.d6t_room_id, msg.t == -10)
      }
      return
    }

    switch (msg.k) {
      case "host":
        let hosted_room = registerRoom(ws)
        send(ws, "hosted", { code: hosted_room.code })
        return
      case "join":
        if (missingComps(msg, ["code", "prof"])) return
        let join_idx = findRoom(msg.d.code)
        if (join_idx >= 0) {
          addSockToRoom(ws, rooms[join_idx])
          send(ws, "crown", rooms[join_idx].host.d6t_room_id)
          send(rooms[join_idx].host, "joiner", {
            id: ws.d6t_room_id,
            prof: msg.d.prof,
          })
        }
        return
      case "crown":
        if (msg.d == null) return
        sendToRoom(ws.d6t_room, "crown", switchRoomHost(ws.d6t_room, msg.d))
        return
    }
  })
})
