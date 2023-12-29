/**
 * Module dependencies.
 */

import http from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import enchilada from "enchilada";
import * as eio from "engine.io";
import express from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = eio.attach(server);

app.use(
  enchilada({
    src: `${__dirname}/public`,
    debug: true,
  }),
);
app.use(express.static(`${__dirname}/public`));
app.get("/", (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

io.on("connection", (socket) => {
  socket.on("message", () => {
    socket.send("pong");
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`\x1B[96mlistening on localhost:${port} \x1B[39m`);
});
