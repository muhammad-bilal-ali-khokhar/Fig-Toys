import { httpRouter } from "convex/server";
import { redeem } from "./redeem";
import { mintActivationCode } from "./mint";
import { getActivationCodeDetails } from "./licenses";
import { adminMutate, adminSnapshot, installStatusHttp } from "./admin";
import {
  claimInstallationHttp,
  portalPayment,
  portalRegister,
  portalState,
} from "./portal";
import { reportCrash } from "./crashes";

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

http.route({
  path: "/admin/snapshot",
  method: "POST",
  handler: adminSnapshot,
});

http.route({
  path: "/admin/mutate",
  method: "POST",
  handler: adminMutate,
});

http.route({
  path: "/install/status",
  method: "POST",
  handler: installStatusHttp,
});

http.route({
  path: "/crash/report",
  method: "POST",
  handler: reportCrash,
});

http.route({
  path: "/install/claim",
  method: "POST",
  handler: claimInstallationHttp,
});

http.route({
  path: "/portal/state",
  method: "POST",
  handler: portalState,
});

http.route({
  path: "/portal/register",
  method: "POST",
  handler: portalRegister,
});

http.route({
  path: "/portal/payment",
  method: "POST",
  handler: portalPayment,
});

export default http;
