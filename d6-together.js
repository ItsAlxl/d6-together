const PORT = 6462

let ws = require("ws")
const wss = new ws.Server({
  server: require("connect")()
    .use(require("serve-static")(__dirname + "/public"))
    .listen(PORT, () => console.log("d6 Together open on port :" + PORT)),
})

wss.on("connection", function connection(ws) {
  ws.on("error", console.error)

  ws.on("message", function message(data) {
    console.log("rebound: %s", data)
    ws.send(String(data))
  })
})
