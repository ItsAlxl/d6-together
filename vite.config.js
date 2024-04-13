import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

export default {
  root: "src",
  build: {
    outDir: "../dist",
  },
  plugins: [wasm(), topLevelAwait()],
}
