import { Liquid } from "liquidjs";
import * as settings from "../settings.js";

export const engine = new Liquid({
  root: settings.viewPath,
  extname: ".liquid",
  cache: settings.NODE_ENV === "production",
});
