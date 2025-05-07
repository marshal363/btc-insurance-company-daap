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

// Check transaction status for pending policy transactions every 5 minutes
// This job implements CV-PR-212 from the implementation roadmap
crons.interval(
  "check-transaction-status",
  { minutes: 5 },
  internal.transactionStatusJobs.checkTransactionStatusJob,
  {}
);

// Check for expired policies daily at 01:00 UTC
// This job implements CV-PR-213 from the implementation roadmap
crons.daily(
  "check-expired-policies",
  { hourUTC: 1, minuteUTC: 0 },
  internal.transactionStatusJobs.checkExpiredPoliciesJob,
  {}
);

// Process settlements for exercised policies every hour
// This job implements CV-PR-214 from the implementation roadmap
crons.interval(
  "process-settlements",
  { hours: 1 },
  internal.settlementJobs.processSettlementsJob,
  {}
);

// Auto-reconcile on-chain vs off-chain policy states every 4 hours
// This job implements CV-PR-215 from the implementation roadmap
crons.interval(
  "auto-reconciliation",
  { hours: 4 },
  internal.reconciliationJobs.autoReconciliationJob,
  {}
);

// Run the initial one-time bulk fetch of 360 days when the app starts
// This is useful for development and testing, but might want to disable in production
// once the initial data is loaded
// crons.interval("initial-bulk-fetch", { seconds: 30 }, internal.prices.fetchHistoricalPrices, {}, { runOnStart: true });

export default crons;
