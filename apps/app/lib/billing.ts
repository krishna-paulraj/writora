import { apiError, apiFetch } from "./api";
import type { PlanName } from "./account";

/** Starts Stripe Checkout for a paid plan and redirects the browser to it. */
export async function startCheckout(
  plan: Exclude<PlanName, "free">,
): Promise<void> {
  const res = await apiFetch("/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error(await apiError(res, "Could not start checkout"));
  const { url } = (await res.json()) as { url: string };
  window.location.href = url;
}

/** Opens the Stripe Customer Portal (manage/cancel) and redirects to it. */
export async function openBillingPortal(): Promise<void> {
  const res = await apiFetch("/billing/portal", { method: "POST" });
  if (!res.ok) {
    throw new Error(await apiError(res, "Could not open the billing portal"));
  }
  const { url } = (await res.json()) as { url: string };
  window.location.href = url;
}
