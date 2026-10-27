import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "license expiry alerts",
  { hourUTC: 4, minuteUTC: 0 },
  internal.expiry.check,
);

export default crons;
