let ws = null

export const SERVER_SENDER_ID = -1
export let HOST_SENDER_ID = 0

export const SEND_ALL = -1
export const SEND_OTHERS = -2
export const SEND_SERVER = null

export const cb = {}

const DBG_OUTPUTS = false

// global so that users can change it from the web console
window.d6t.WS_ADDRESS = getDefaultWsAddress()

export function send(key, data, target) {
  const o = { k: key }
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
  const f = cb[msg.k]
  if (DBG_OUTPUTS) {
    console.log("<< IN : '%s' from %s", msg.k, local ? "LOCAL" : msg.s == -1 ? "SERVER" : msg.s)
    console.log(msg.d)
    console.log("- << -")
  }
  if (f) {
    f(msg.d, msg.s)
  }
}

function getDefaultWsAddress() {
  return (window.location.protocol == "https:" ? "wss://" : "ws://") + window.location.host
}

function openConnection(join_data = null) {
  ws = new WebSocket(window.d6t.WS_ADDRESS)

  ws.onopen = (event) => {
    d6t.showDisconnectAlert(false)
    if (join_data == null) {
      send("host", null, SEND_SERVER)
    } else {
      send("join", join_data, SEND_SERVER)
    }
  }

  ws.onmessage = (message) => {
    const msg = JSON.parse(message.data)
    if (!msg || msg.k == null) return
    rpcFromMessage(msg)
  }

  ws.onclose = (ev) => {
    d6t.showDisconnectAlert(true)
  }

  ws.onerror = (error) => {
    d6t.showDisconnectAlert(true)
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

export function isHost(id = MY_PLR_ID) {
  return id == HOST_SENDER_ID
}

export function setHost(id) {
  HOST_SENDER_ID = id
}
