import { convexTest } from "convex-test-utils";
import { expect, test, describe, beforeAll, afterAll } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { TransactionStatus, TransactionType } from "./transactions"; // Assuming enums are exported
import { Id } from "./_generated/dataModel"; // Corrected import for Id

describe("Transaction Status Management", () => {
  let t: ReturnType<typeof convexTest>;
  let testUserId: string;
  let testQuoteId: string;

  beforeAll(async () => {
    t = convexTest(schema);
    // Seed a user or use a mock user ID
    testUserId = "user_" + Math.random().toString(36).substring(7);
    testQuoteId = "quote_" + Math.random().toString(36).substring(7);
  });

  afterAll(() => {
    // Clean up if necessary, though convexTest usually handles this for in-memory
  });

  test("TS-101 & Create: Should create a new transaction in PENDING state", async () => {
    const txId = await t.mutation(api.transactions.createTransaction)({
      userId: testUserId,
      quoteId: testQuoteId as Id<"quotes">,
      type: TransactionType.POLICY_CREATION,
      network: "testnet",
      parameters: { amount: 100, currency: "USD" },
    });
    expect(txId).toBeDefined();

    const transaction = await t.query(api.transactions.getTransactionStatus)({ transactionId: txId });
    expect(transaction).not.toBeNull();
    if (!transaction) return; // Type guard

    expect(transaction.userId).toBe(testUserId);
    expect(transaction.quoteId).toEqual(testQuoteId as Id<"quotes">);
    expect(transaction.type).toBe(TransactionType.POLICY_CREATION);
    expect(transaction.status).toBe(TransactionStatus.PENDING);
    expect(transaction.network).toBe("testnet");
    expect(transaction.parameters).toEqual({ amount: 100, currency: "USD" });
    expect(transaction.createdAt).toBeTypeOf("number");
    expect(transaction.updatedAt).toBeTypeOf("number");
    expect(transaction.createdAt).toEqual(transaction.updatedAt);
    expect(transaction.errorDetails).toBeUndefined();
  });

  test("TS-102 & TS-104: Should update transaction status and details correctly (PENDING -> SUBMITTED)", async () => {
    const localQuoteId = "quote_submit" as Id<"quotes">;
    const txId = await t.mutation(api.transactions.createTransaction)({
      userId: testUserId,
      quoteId: localQuoteId,
      type: TransactionType.CAPITAL_COMMITMENT,
    });

    const submittedTxHash = "0x123abc";
    const submittedNetwork = "mainnet";
    const updateTime = Date.now(); // Approximate

    const updatedTx = await t.mutation(api.transactions.updateTransactionStatus)({
      transactionId: txId,
      newStatus: TransactionStatus.SUBMITTED,
      txHash: submittedTxHash,
      network: submittedNetwork,
    });

    expect(updatedTx).not.toBeNull();
    if (!updatedTx) return;

    expect(updatedTx.status).toBe(TransactionStatus.SUBMITTED);
    expect(updatedTx.txHash).toBe(submittedTxHash);
    expect(updatedTx.network).toBe(submittedNetwork);
    expect(updatedTx.submittedAt).toBeTypeOf("number");
    expect(updatedTx.submittedAt).toBeGreaterThanOrEqual(updateTime);
    expect(updatedTx.updatedAt).toBeGreaterThanOrEqual(updatedTx.createdAt!);
    expect(updatedTx.errorDetails).toBeUndefined(); // Error should be cleared on submit
  });

  test("TS-102 & TS-104: Should update transaction status to FAILED with error details", async () => {
    const localQuoteId = "quote_fail" as Id<"quotes">;
    const txId = await t.mutation(api.transactions.createTransaction)({
      userId: testUserId,
      quoteId: localQuoteId,
      type: TransactionType.POLICY_CREATION,
    });

    const error = {
      message: "User rejected transaction",
      code: "USER_REJECTION",
      rawError: "Signature declined by user in wallet",
      retryable: true,
    };
    const failTime = Date.now();

    const failedTx = await t.mutation(api.transactions.updateTransactionStatus)({
      transactionId: txId,
      newStatus: TransactionStatus.FAILED,
      errorDetails: error,
    });

    expect(failedTx).not.toBeNull();
    if (!failedTx) return;

    expect(failedTx.status).toBe(TransactionStatus.FAILED);
    expect(failedTx.errorDetails).toEqual(error);
    expect(failedTx.confirmedOrFailedAt).toBeTypeOf("number");
    expect(failedTx.confirmedOrFailedAt).toBeGreaterThanOrEqual(failTime);
  });

   test("TS-102: Should transition from SUBMITTED to CONFIRMED", async () => {
    const localQuoteId = "q_confirm" as Id<"quotes">;
    const txId = await t.mutation(api.transactions.createTransaction)({
        userId: testUserId, quoteId: localQuoteId, type: TransactionType.POLICY_CREATION
    });
    await t.mutation(api.transactions.updateTransactionStatus)({
        transactionId: txId, newStatus: TransactionStatus.SUBMITTED, txHash: "0xconfirm"
    });

    const confirmTime = Date.now();
    const confirmedTx = await t.mutation(api.transactions.updateTransactionStatus)({
        transactionId: txId,
        newStatus: TransactionStatus.CONFIRMED,
        blockHeight: 123456
    });

    expect(confirmedTx?.status).toBe(TransactionStatus.CONFIRMED);
    expect(confirmedTx?.blockHeight).toBe(123456);
    expect(confirmedTx?.confirmedOrFailedAt).toBeTypeOf("number");
    expect(confirmedTx?.confirmedOrFailedAt).toBeGreaterThanOrEqual(confirmTime);
    expect(confirmedTx?.errorDetails).toBeUndefined();
  });

  test("TS-102: Should prevent invalid status transitions (e.g., CONFIRMED to PENDING)", async () => {
    const localQuoteId = "q_invalid_transition" as Id<"quotes">;
    const txId = await t.mutation(api.transactions.createTransaction)({
        userId: testUserId, quoteId: localQuoteId, type: TransactionType.POLICY_CREATION
    });
    await t.mutation(api.transactions.updateTransactionStatus)({
        transactionId: txId, newStatus: TransactionStatus.SUBMITTED, txHash: "0xinv1"
    });
    await t.mutation(api.transactions.updateTransactionStatus)({
        transactionId: txId, newStatus: TransactionStatus.CONFIRMED, blockHeight: 1
    });

    await expect(
      t.mutation(api.transactions.updateTransactionStatus)({
        transactionId: txId,
        newStatus: TransactionStatus.PENDING, // Invalid transition
      })
    ).rejects.toThrow(/Invalid status transition/);
  });

  test("TS-103: getTransactionStatus should retrieve a specific transaction", async () => {
    const localQuoteId = "quote_get_status" as Id<"quotes">;
    const txId = await t.mutation(api.transactions.createTransaction)({
      userId: testUserId,
      quoteId: localQuoteId,
      type: TransactionType.POLICY_CREATION,
    });

    const fetchedTx = await t.query(api.transactions.getTransactionStatus)({ transactionId: txId });
    expect(fetchedTx).not.toBeNull();
    expect(fetchedTx?._id).toEqual(txId);
    expect(fetchedTx?.quoteId).toEqual(localQuoteId);
  });

  test("TS-105: getTransactionsForUser should retrieve transactions for a user, with optional filters", async () => {
    // Create a mix of transactions for two users
    const user1 = "user_A";
    const user2 = "user_B";
    const qA1 = "qA1" as Id<"quotes">;
    const qA2 = "qA2" as Id<"quotes">;
    const qB1 = "qB1" as Id<"quotes">;

    await t.mutation(api.transactions.createTransaction)({ userId: user1, quoteId: qA1, type: TransactionType.POLICY_CREATION });
    const txA2Id = await t.mutation(api.transactions.createTransaction)({ userId: user1, quoteId: qA2, type: TransactionType.CAPITAL_COMMITMENT });
    await t.mutation(api.transactions.createTransaction)({ userId: user2, quoteId: qB1, type: TransactionType.POLICY_CREATION });
    
    // Update one of user1's transactions to FAILED
    await t.mutation(api.transactions.updateTransactionStatus)({
        transactionId: txA2Id, newStatus: TransactionStatus.FAILED, errorDetails: {message: "test fail"}
    });

    // Get all for user1
    const user1Txs = await t.query(api.transactions.getTransactionsForUser)({ userId: user1 });
    expect(user1Txs.length).toBe(2);
    // Default order is desc by createdAt, so qA2 then qA1 usually
    expect(user1Txs.map(tx => tx.quoteId).sort()).toEqual([qA1, qA2].sort());

    // Get PENDING for user1 (only qA1 should be PENDING)
    const user1PendingTxs = await t.query(api.transactions.getTransactionsForUser)({ userId: user1, status: TransactionStatus.PENDING });
    expect(user1PendingTxs.length).toBe(1);
    expect(user1PendingTxs[0].quoteId).toEqual(qA1);
    expect(user1PendingTxs[0].status).toBe(TransactionStatus.PENDING);

    // Get FAILED for user1 (only qA2 should be FAILED)
    const user1FailedTxs = await t.query(api.transactions.getTransactionsForUser)({ userId: user1, status: TransactionStatus.FAILED });
    expect(user1FailedTxs.length).toBe(1);
    expect(user1FailedTxs[0].quoteId).toEqual(qA2);

    // Get CAPITAL_COMMITMENT for user1 (only qA2)
    const user1CapitalTxs = await t.query(api.transactions.getTransactionsForUser)({ userId: user1, type: TransactionType.CAPITAL_COMMITMENT });
    expect(user1CapitalTxs.length).toBe(1);
    expect(user1CapitalTxs[0].quoteId).toEqual(qA2);
    
    // Get with limit
    const user1LimitedTxs = await t.query(api.transactions.getTransactionsForUser)({ userId: user1, limit: 1 });
    expect(user1LimitedTxs.length).toBe(1);

    // Get for user2 (should be 1 transaction)
    const user2Txs = await t.query(api.transactions.getTransactionsForUser)({ userId: user2 });
    expect(user2Txs.length).toBe(1);
    expect(user2Txs[0].quoteId).toEqual(qB1);

    // Test new compound index: user1, POLICY_CREATION, PENDING
    const user1PolicyPendingTxs = await t.query(api.transactions.getTransactionsForUser)({
      userId: user1,
      type: TransactionType.POLICY_CREATION,
      status: TransactionStatus.PENDING,
    });
    expect(user1PolicyPendingTxs.length).toBe(1);
    expect(user1PolicyPendingTxs[0].quoteId).toEqual(qA1);
    expect(user1PolicyPendingTxs[0].type).toBe(TransactionType.POLICY_CREATION);
    expect(user1PolicyPendingTxs[0].status).toBe(TransactionStatus.PENDING);

    // Test new compound index: user1, CAPITAL_COMMITMENT, FAILED
    const user1CapitalFailedTxs = await t.query(api.transactions.getTransactionsForUser)({
      userId: user1,
      type: TransactionType.CAPITAL_COMMITMENT,
      status: TransactionStatus.FAILED,
    });
    expect(user1CapitalFailedTxs.length).toBe(1);
    expect(user1CapitalFailedTxs[0].quoteId).toEqual(qA2);
    expect(user1CapitalFailedTxs[0].type).toBe(TransactionType.CAPITAL_COMMITMENT);
    expect(user1CapitalFailedTxs[0].status).toBe(TransactionStatus.FAILED);

    // Test new compound index: user1, POLICY_CREATION, FAILED (should be 0)
    const user1PolicyFailedTxs = await t.query(api.transactions.getTransactionsForUser)({
        userId: user1,
        type: TransactionType.POLICY_CREATION,
        status: TransactionStatus.FAILED,
      });
    expect(user1PolicyFailedTxs.length).toBe(0);

  });

  test("updateTransactionStatus should clear errorDetails when transitioning to non-FAILED state without new error", async () => {
    const localQuoteId = "quote_clear_error" as Id<"quotes">;
    const txId = await t.mutation(api.transactions.createTransaction)({
      userId: testUserId,
      quoteId: localQuoteId,
      type: TransactionType.POLICY_CREATION,
    });
    // Set to FAILED first
    await t.mutation(api.transactions.updateTransactionStatus)({
      transactionId: txId,
      newStatus: TransactionStatus.FAILED,
      errorDetails: { message: "Initial failure", retryable: true },
    });
    let tx = await t.query(api.transactions.getTransactionStatus)({transactionId: txId});
    expect(tx?.errorDetails).toBeDefined();

    // Transition to SUBMITTED (e.g. a retry)
    await t.mutation(api.transactions.updateTransactionStatus)({
      transactionId: txId,
      newStatus: TransactionStatus.SUBMITTED, // Non-FAILED state
      txHash: "0xretry"
    });
    tx = await t.query(api.transactions.getTransactionStatus)({transactionId: txId});
    expect(tx?.status).toBe(TransactionStatus.SUBMITTED);
    expect(tx?.errorDetails).toBeUndefined(); // Error should be cleared
  });

}); 