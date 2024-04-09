const ws = new WebSocket("ws://localhost:6462")

window.MY_NET_ID = 1

function ws_send(key, data) {
  ws.send(JSON.stringify({ k: key, d: data }))
}

ws.onopen = (event) => {
  ws_send("hi", { ding: "dong" })
}
ws.onmessage = (event) => {
  console.log(JSON.parse(event.data))
}