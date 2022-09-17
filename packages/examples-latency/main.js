import "./style.css";

/**
 * Module dependencies.
 */

import { SmoothieChart, TimeSeries } from "smoothie";
import * as eio from "engine.io-client";

// helper

function $(id) {
  return document.getElementById(id);
}

// chart

let smoothie;
let time;

function render() {
  if (smoothie) smoothie.stop();
  $("chart").width = document.body.clientWidth;
  smoothie = new SmoothieChart();
  smoothie.streamTo($("chart"), 1000);
  time = new TimeSeries();
  smoothie.addTimeSeries(time, {
    strokeStyle: "rgb(255, 0, 0)",
    fillStyle: "rgba(255, 0, 0, 0.4)",
    lineWidth: 2,
  });
}

// socket
const url = new URL(import.meta.env.VITE_WS_URL);
const opts = {
  transports: ["websocket"],
};
if (url.pathname !== "/") {
  opts["path"] = url.pathname;
}
const socket = new eio.Socket(url.origin, opts);

// hack: send initial packet
const ws = socket.transport.ws;
const fn_onopen_initial = ws.onopen?.bind(ws);
ws.onopen = async () => {
  ws.send("6handshake");
  await fn_onopen_initial();
};

let last;
function send() {
  last = new Date();
  socket.send("ping");
  $("transport").innerHTML = socket.transport.name;
}

socket.on("open", () => {
  if ($("chart").getContext) {
    render();
    window.onresize = render;
  }
  send();
});

socket.on("close", () => {
  if (smoothie) smoothie.stop();
  $("transport").innerHTML = "(disconnected)";
});

socket.on("message", () => {
  const latency = new Date() - last;
  $("latency").innerHTML = latency + "ms";
  if (time) time.append(+new Date(), latency);

  // setTimeout(send, 100);
  setTimeout(send, 1000);
});

socket.on("error", () => {
  if (smoothie) smoothie.stop();
  $("transport").innerHTML = "(error)";
});
