import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

// HTTP request handlers
const http = httpRouter();

// Define allowed external APIs
http.route({
  path: "/api/*",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // This will be a fallback handler - actual API integration is in the price feeds
    return new Response("API gateway", { status: 200 });
  }),
});

// Define allowed external domains for http.get usage in queries and actions
const allowedDomains = [
  "api.binance.com",
  "api.coinbase.com",
  "api.kraken.com",
];

export default http;
