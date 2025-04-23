import { describe, expect, it } from "vitest";
import { Cl, BooleanCV } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const donor1 = accounts.get("wallet_1")!;

function getCurrentStxBalance(address: string) {
  const assetsMap = simnet.getAssetsMap();
  return assetsMap.get("STX")?.get(address) || BigInt(0);
}

describe("fundraising campaign", () => {
  // helper to set up a basic campaign
  const initCampaign = async (goal: number) => {
    const response = await simnet.callPublicFn(
      "fundraising",
      "initialize-campaign",
      [Cl.uint(goal), Cl.uint(0)],
      deployer
    );
    const block = simnet.burnBlockHeight;

    return { response, block };
  };

  it("initializes with a goal", async () => {
    const { response } = await initCampaign(100000);
    expect(response.result).toBeOk(Cl.uint(1));
  });

  it("accepts STX donations during campaign", async () => {
    await initCampaign(100000);
    const response = await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(5000)],
      donor1
    );
    expect(response.result).toBeOk(Cl.uint(1));

    // verify donation was recorded
    const getDonationResponse = await simnet.callReadOnlyFn(
      "fundraising",
      "get-stx-donation",
      [Cl.standardPrincipal(donor1)],
      donor1
    );
    expect(getDonationResponse.result).toBeOk(Cl.uint(5000));
  });

  // TODO: write sBTC tests when there is a way to fund simnet wallets with sBTC

  // it("accepts sBTC donations during campaign", async () => {
  //   // Mint some sBTC for the donor
  //   const mintResponse = await simnet.callPublicFn(
  //     "sbtc-token",
  //     "protocol-mint",
  //     [Cl.uint(70000), Cl.principal(donor2), Cl.buffer(new Uint8Array([0]))],
  //     deployer
  //   );
  //   expect(mintResponse.result).toBeOk(Cl.bool(true));

  //   await initCampaign(100000);
  //   const response = await simnet.callPublicFn(
  //     "fundraising",
  //     "donate-sbtc",
  //     [Cl.uint(700)],
  //     donor2
  //   );
  //   console.log(JSON.stringify(response, null, 2));

  //   expect(response.result).toBeOk(Cl.bool(true));

  //   // verify donation was recorded
  //   const getDonationResponse = await simnet.callReadOnlyFn(
  //     "fundraising",
  //     "get-sbtc-donation",
  //     [Cl.principal(donor1)],
  //     donor2
  //   );
  //   expect(getDonationResponse.result).toBeOk(Cl.uint(700));
  // });

  it("prevents non-owner from initializing campaign", async () => {
    const response = await simnet.callPublicFn(
      "fundraising",
      "initialize-campaign",
      [Cl.uint(100000), Cl.uint(0)],
      donor1
    );
    expect(response.result).toBeErr(Cl.uint(100)); // err-not-authorized
  });

  it("allows multiple donations from same donor", async () => {
    await initCampaign(100000);

    // first donation
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(5000)],
      donor1
    );

    // second donation
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(3000)],
      donor1
    );

    const getDonationResponse = await simnet.callReadOnlyFn(
      "fundraising",
      "get-stx-donation",
      [Cl.standardPrincipal(donor1)],
      donor1
    );
    expect(getDonationResponse.result).toBeOk(Cl.uint(8000));
  });

  it("prevents donations after campaign ends", async () => {
    await initCampaign(100000);

    // move past campaign duration
    await simnet.mineEmptyBlocks(4321);

    const response = await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(5000)],
      donor1
    );
    expect(response.result).toBeErr(Cl.uint(101)); // err-campaign-ended
  });

  it("prevents withdrawal before campaign ends", async () => {
    await initCampaign(10000);

    // make a donation to meet goal
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(15000)],
      donor1
    );

    const response = await simnet.callPublicFn(
      "fundraising",
      "withdraw",
      [],
      deployer
    );
    expect(response.result).toBeErr(Cl.uint(104)); // err-campaign-not-ended
  });

  it("allows withdrawal when campaign ended", async () => {
    await initCampaign(10000);

    const originalDeployerBalance = getCurrentStxBalance(deployer);
    const donationAmount = BigInt(5000000000);

    // make a donation (does not meet goal)
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(donationAmount)],
      donor1
    );

    // move past campaign duration
    await simnet.mineEmptyBlocks(4321);

    const response = await simnet.callPublicFn(
      "fundraising",
      "withdraw",
      [],
      deployer
    );

    expect(response.result).toBeOk(Cl.uint(1));

    expect(getCurrentStxBalance(deployer)).toEqual(
      originalDeployerBalance + donationAmount
    );
  });

  it("prevents withdrawal when campaign is cancelled", async () => {
    await initCampaign(100000);

    // make a small donation that won't meet goal
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(5000)],
      donor1
    );

    // move past campaign duration
    await simnet.mineEmptyBlocks(4321);

    const cancelResponse = await simnet.callPublicFn(
      "fundraising",
      "cancel-campaign",
      [],
      deployer
    );
    expect(cancelResponse.result).toBeOk(Cl.uint(1));

    const response = await simnet.callPublicFn(
      "fundraising",
      "withdraw",
      [],
      deployer
    );
    expect(response.result).toBeErr(Cl.uint(105)); // err-campaign-cancelled
  });

  it("allows one refund when campaign is cancelled", async () => {
    await initCampaign(100000);

    const originalDonorBalance = getCurrentStxBalance(donor1);
    const donationAmount = BigInt(5000000000); // Donation in microstacks = 5,000 stx

    // make a donation
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(donationAmount)],
      donor1
    );

    // verify that funds have been transferred out of the donor's account
    expect(getCurrentStxBalance(donor1)).toEqual(
      originalDonorBalance - donationAmount
    );

    // Cancel campaign
    const cancelResponse = await simnet.callPublicFn(
      "fundraising",
      "cancel-campaign",
      [],
      deployer
    );
    expect(cancelResponse.result).toBeOk(Cl.uint(1));

    // Request refund
    const response = await simnet.callPublicFn(
      "fundraising",
      "refund",
      [],
      donor1
    );
    expect(response.result).toBeOk(Cl.uint(1));

    // verify funds were restored
    expect(getCurrentStxBalance(donor1)).toEqual(originalDonorBalance);

    // verify donation was cleared
    const getDonationResponse = await simnet.callReadOnlyFn(
      "fundraising",
      "get-stx-donation",
      [Cl.standardPrincipal(donor1)],
      donor1
    );
    expect(getDonationResponse.result).toBeOk(Cl.uint(0));

    // request another refund, verify that donor's balance stays the same
    await simnet.callPublicFn("fundraising", "refund", [], donor1);
    expect(getCurrentStxBalance(donor1)).toEqual(originalDonorBalance);
  });

  it("prevents refund when campaign is not cancelled", async () => {
    await initCampaign(10000);

    // make a donation
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(15000000000)], // donation in microstacks
      donor1
    );

    // move past campaign duration
    await simnet.mineEmptyBlocks(4321);

    const response = await simnet.callPublicFn(
      "fundraising",
      "refund",
      [],
      donor1
    );
    expect(response.result).toBeErr(Cl.uint(103)); // err-not-cancelled
  });

  it("returns campaign info correctly", async () => {
    const { block } = await initCampaign(100000);

    const response = await simnet.callReadOnlyFn(
      "fundraising",
      "get-campaign-info",
      [],
      deployer
    );

    expect(response.result.value).toEqual(
      Cl.tuple({
        start: Cl.uint(block),
        end: Cl.uint(block + 4320),
        goal: Cl.uint(100000),
        totalStx: Cl.uint(0),
        totalSbtc: Cl.uint(0),
        donationCount: Cl.uint(0),
        isExpired: Cl.bool(false),
        isWithdrawn: Cl.bool(false),
        isCancelled: Cl.bool(false),
      })
    );

    // check again after a donation
    const donationAmount = BigInt(5000000000); // 5000 STX, in microstacks
    await simnet.callPublicFn(
      "fundraising",
      "donate-stx",
      [Cl.uint(donationAmount)],
      donor1
    );

    const response2 = await simnet.callReadOnlyFn(
      "fundraising",
      "get-campaign-info",
      [],
      deployer
    );

    expect(response2.result.value).toEqual(
      Cl.tuple({
        start: Cl.uint(block),
        end: Cl.uint(block + 4320),
        goal: Cl.uint(100000),
        totalStx: Cl.uint(donationAmount),
        totalSbtc: Cl.uint(0),
        donationCount: Cl.uint(1),
        isExpired: Cl.bool(false),
        isWithdrawn: Cl.bool(false),
        isCancelled: Cl.bool(false),
      })
    );

    // move past campaign duration
    await simnet.mineEmptyBlocks(4321);

    // Verify campaign shows expired
    const response3 = await simnet.callReadOnlyFn(
      "fundraising",
      "get-campaign-info",
      [],
      deployer
    );

    expect(response3.result.value).toEqual(
      Cl.tuple({
        start: Cl.uint(block),
        end: Cl.uint(block + 4320),
        goal: Cl.uint(100000),
        totalStx: Cl.uint(donationAmount),
        totalSbtc: Cl.uint(0),
        donationCount: Cl.uint(1),
        isExpired: Cl.bool(true),
        isWithdrawn: Cl.bool(false),
        isCancelled: Cl.bool(false),
      })
    );
  });
});
