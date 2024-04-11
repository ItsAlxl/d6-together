let ws = null

export const SERVER_SENDER_ID = -1
export const HOST_SENDER_ID = 0

export const SEND_ALL = -1
export const SEND_OTHERS = -2

export const cb = {}

const DBG_OUTPUTS = true

export function send(key, data, target) {
  let o = { k: key }
  if (data != null) o.d = data
  if (target != null) o.t = target

  if (DBG_OUTPUTS) {
    console.log(
      ">> OUT : '%s' to %s",
      key,
      target == SEND_ALL
        ? "ALL"
        : target == SEND_OTHERS
        ? "OTHERS"
        : target == null
        ? "SERVER"
        : target
    )
    console.log(data)
    console.log("- >> -")
  }
  if (target == MY_PLR_ID || target == SEND_ALL) {
    rpcFromMessage(o, true)
  }
  if (target != MY_PLR_ID) {
    ws.send(JSON.stringify(o))
  }
}

function rpcFromMessage(msg, local = false) {
  if (local) msg.s = MY_PLR_ID
  let f = cb[msg.k]
  if (DBG_OUTPUTS) {
    console.log("<< IN : '%s' from %s", msg.k, local ? "LOCAL" : msg.s == -1 ? "SERVER" : msg.s)
    console.log(msg.d)
    console.log("- << -")
  }
  if (f) {
    f(msg.d, msg.s)
  }
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
    if (!msg || msg.k == null) return
    rpcFromMessage(msg)
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

export function isConnected() {
  return ws != null
}
