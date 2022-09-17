import httpPkg from "node:http";
import { app } from "./app.js";

const http = httpPkg.createServer().listen(3000);
app.server.attach(http);
