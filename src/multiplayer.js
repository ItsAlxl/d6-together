let ws = null

export const SERVER_SENDER_ID = -1
export const HOST_SENDER_ID = 0

export const cb = {}

export function send(key, data, target) {
  let o = { k: key }
  if (data) o.d = data
  if (target) o.t = target

  console.log("-- OUT --")
  console.log(o)
  console.log("-- --- --")
  ws.send(JSON.stringify(o))
}

function openConnection(join_data = null, address = "ws://localhost:6462") {
  ws = new WebSocket(address)

  ws.onopen = (event) => {
    if (join_data == null) {
      send("host")
    } else {
      send("join", join_data)
    }
  }

  ws.onmessage = (message) => {
    let msg = JSON.parse(message.data)
    if (!msg || !msg.k) return

    let f = cb[msg.k]
    console.log("-- IN --")
    console.log("%s : %s", msg.s, msg.k)
    console.log(msg.d)
    console.log("-- -- --")
    if (f) {
      f(msg.d, msg.s)
    }
  }
}

export function hostGame() {
  openConnection()
}

export function joinGame(room_code, prof_data) {
  openConnection({
    code: room_code,
    prof: prof_data,
  })
}
