import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Define cron jobs
const crons = cronJobs();

// Fetch prices every 5 minutes
crons.interval("fetch-prices", { minutes: 5 }, internal.prices.fetchPrices, {});

// Prepare Oracle Submission Data every 5 minutes (will eventually trigger threshold check + submission)
crons.interval(
  "check-and-submit-oracle-price",
  { minutes: 5 }, 
  internal.blockchainIntegration.checkAndSubmitOraclePrice,
  {}
);

// Fetch historical data every hour (full refresh)
crons.interval("fetch-historical", { hours: 1 }, internal.prices.fetchHistoricalPrices, {});

// Update just the latest daily price once per day (more efficient daily updates)
// Running at 00:15 UTC each day
crons.daily("fetch-latest-daily", { hourUTC: 0, minuteUTC: 15 }, internal.prices.fetchLatestDailyPrice, {});

// Run the initial one-time bulk fetch of 360 days when the app starts
// This is useful for development and testing, but might want to disable in production
// once the initial data is loaded
// crons.interval("initial-bulk-fetch", { seconds: 30 }, internal.prices.fetchHistoricalPrices, {}, { runOnStart: true });

export default crons;
