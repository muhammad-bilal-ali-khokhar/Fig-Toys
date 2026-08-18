import { httpRouter } from "convex/server";
import { redeem } from "./redeem";
import { mintActivationCode } from "./mint";
import { getActivationCodeDetails } from "./licenses";

const http = httpRouter();

http.route({
  path: "/redeem",
  method: "POST",
  handler: redeem,
});

http.route({
  path: "/mint",
  method: "POST",
  handler: mintActivationCode,
});

http.route({
  path: "/details",
  method: "POST",
  handler: getActivationCodeDetails,
});

export default http;