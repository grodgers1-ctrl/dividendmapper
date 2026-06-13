// The 6-step lifecycle sequence. Each entry is one email. The cron walks every
// free user against this list daily; idempotency via sent_emails.send_key.
// Skip-gates and template components are wired in later modules.

export type LifecycleStepKey =
  | "welcome_free"
  | "activation_nudge"
  | "score_explainer"
  | "pro_pitch_1"
  | "monthly_recap"
  | "pro_pitch_final";

export interface LifecycleStep {
  key: LifecycleStepKey;
  daysAfterSignup: number;
  subject: string;
  transactional: boolean;
}

export const SEQUENCE: readonly LifecycleStep[] = [
  {
    key: "welcome_free",
    daysAfterSignup: 0,
    subject: "Welcome to DividendMapper",
    transactional: true,
  },
  {
    key: "activation_nudge",
    daysAfterSignup: 3,
    subject: "Add a holding to see what the score does",
    transactional: true,
  },
  {
    key: "score_explainer",
    daysAfterSignup: 7,
    subject: "Here's what your resilience score is telling you",
    transactional: false,
  },
  {
    key: "pro_pitch_1",
    daysAfterSignup: 14,
    subject: "Here's what Pro would say about your portfolio today",
    transactional: false,
  },
  {
    key: "monthly_recap",
    daysAfterSignup: 30,
    subject: "Your DividendMapper recap",
    transactional: false,
  },
  {
    key: "pro_pitch_final",
    daysAfterSignup: 60,
    subject: "50% off your first month of Pro",
    transactional: false,
  },
] as const;
