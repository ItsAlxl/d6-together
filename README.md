# d6 Together
A web app for playing [Forged in the Dark](https://bladesinthedark.com/forged-dark) games online. d6 Together uses ws for networking, Rapier 3D for phsyics, and three.js for 3D rendering.

## Running the Server
You can build and run your own server from the source code; all you strictly need is [NodeJS](https://nodejs.org/) (v18.20 or later). You can get the source code from [GitHub](https://github.com/ItsAlxl/d6-together).

Once you have the code, execute the following commands within the project root to start the server.
```sh
# Get dependencies (only needed the first time)
npm install

# Build the application from source (only needed the first time)
npm run build

# Run server
npm run server
```
By default, d6 Together uses port 6462. This can be easily changed at the top of `d6-together.js` (changing the port does NOT require re-building the app). Use your browser to connect to the server (e.g. `localhost:6462`), and you're all set!

When deploying to a production environment, you'll need the `dist/` directory (which is created with `npm run build`), `d6-together.js`, and the `package.json` and `package-lock.json` files. Running `npm install --omit=dev` will install the necessary dependencies, and `npm run server` will run the server. For convenience, those two commands are combined in `npm run deploy`.