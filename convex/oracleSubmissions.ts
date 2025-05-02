import { internalMutation } from './_generated/server';
import { v } from "convex/values";
import { api, internal } from './_generated/api'; // Ensure API imports are correct

// --- Oracle Submission Recording (CVX-303) ---

/**
 * Internal mutation to record an oracle price submission attempt in the database.
 *
 * @param {object} args - The arguments object.
 * @param {string} args.txid - The transaction ID from the broadcast.
 * @param {number} args.submittedPriceSatoshis - The price that was submitted.
 * @param {string} args.reason - The reason the submission was triggered.
 * @param {number | null} args.percentChange - The percentage change from the previous price.
 * @param {number} args.sourceCount - The number of sources for the aggregated price.
 * @param {string} args.status - The initial status (e.g., "submitted").
 */
export const recordOracleSubmission = internalMutation({
  args: {
    txid: v.string(),
    submittedPriceSatoshis: v.number(),
    reason: v.string(),
    percentChange: v.optional(v.number()), // Use optional to match schema (number | undefined)
    sourceCount: v.number(),
    status: v.string(), // e.g., "submitted", "confirmed", "failed"
  },
  handler: async (ctx, { txid, submittedPriceSatoshis, reason, percentChange, sourceCount, status }) => {
    const submissionTimestamp = Date.now();
    console.log(`Recording oracle submission: TxID: ${txid}, Price: ${submittedPriceSatoshis}, Status: ${status}, Reason: ${reason}`);

    await ctx.db.insert("oracleSubmissions", {
      txid: txid,
      submittedPriceSatoshis: submittedPriceSatoshis,
      submissionTimestamp: submissionTimestamp,
      status: status, // Use provided status
      reason: reason,
      percentChange: percentChange,
      sourceCount: sourceCount,
      // confirmationTimestamp and blockHeight will be null initially
    });

    console.log("Oracle submission recorded successfully in oracleSubmissions.ts.");
  },
});

// Optional: Consider adding functions here to update the status later
// e.g., markAsConfirmed, markAsFailed 