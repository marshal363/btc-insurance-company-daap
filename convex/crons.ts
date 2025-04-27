import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Fetch prices every minute
crons.interval("fetch-prices", { seconds: 60 }, internal.prices.fetchPrices, {});

// Fetch historical data every hour
crons.interval("fetch-historical", { hours: 1 }, internal.prices.fetchHistoricalPrices, {});

export default crons;
