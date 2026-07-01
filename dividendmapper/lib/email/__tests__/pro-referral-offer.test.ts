import { describe, it, expect } from "vitest";
import {
  shouldSendReferralOffer,
  PRO_REFERRAL_DELAY_DAYS,
} from "../pro-referral-offer";

describe("shouldSendReferralOffer", () => {
  it("exports a 21-day delay", () => {
    expect(PRO_REFERRAL_DELAY_DAYS).toBe(21);
  });

  it("does not send when already sent, even if long overdue", () => {
    expect(
      shouldSendReferralOffer({ daysSincePro: 9999, alreadySent: true }),
    ).toBe(false);
  });

  it("does not send before the delay elapses", () => {
    expect(
      shouldSendReferralOffer({ daysSincePro: 20, alreadySent: false }),
    ).toBe(false);
  });

  it("does not send at 20.99 days (just under the boundary)", () => {
    expect(
      shouldSendReferralOffer({ daysSincePro: 20.99, alreadySent: false }),
    ).toBe(false);
  });

  it("sends exactly at the 21-day boundary", () => {
    expect(
      shouldSendReferralOffer({ daysSincePro: 21, alreadySent: false }),
    ).toBe(true);
  });

  it("sends when past the delay and not yet sent", () => {
    expect(
      shouldSendReferralOffer({ daysSincePro: 40, alreadySent: false }),
    ).toBe(true);
  });
});
