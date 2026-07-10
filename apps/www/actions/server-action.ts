"use server";
import { actionClient } from "./safe-action";

import { formSchema } from "@/lib/form-schema";

// Resend's REST API — used directly so www doesn't need the `resend` SDK as a
// dependency. Delivery only happens when RESEND_API_KEY + CONTACT_TO_EMAIL are
// configured; otherwise the action reports an honest failure (see below).
const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Upper bounds so a hostile client can't ship a multi-megabyte payload.
const LIMITS = {
  name: 200,
  email: 320,
  company: 200,
  employees: 50,
  message: 5_000,
} as const;

function clean(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const serverAction = actionClient
  .inputSchema(formSchema)
  .action(async ({ parsedInput }) => {
    const name = clean(parsedInput.name, LIMITS.name);
    const email = clean(parsedInput.email, LIMITS.email);
    const company = clean(parsedInput.company, LIMITS.company);
    const employees = clean(parsedInput.employees, LIMITS.employees);
    const message = clean(parsedInput.message, LIMITS.message);

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL;
    const from = process.env.EMAIL_FROM || "Writora <onboarding@resend.dev>";

    // No delivery mechanism wired up — be honest instead of faking success.
    if (!apiKey || !to) {
      return {
        success: false,
        message:
          "Contact form is not configured yet. Please email us directly for now.",
      };
    }

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Company: ${company}` : null,
      employees ? `Employees: ${employees}` : null,
      "",
      message,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const html = [
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
      company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : "",
      employees
        ? `<p><strong>Employees:</strong> ${escapeHtml(employees)}</p>`
        : "",
      `<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(
        /\n/g,
        "<br />",
      )}</p>`,
    ]
      .filter(Boolean)
      .join("");

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: `New contact enquiry from ${name || email}`,
          text,
          html,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `Contact form: Resend responded ${res.status} ${detail.slice(0, 300)}`,
        );
        return {
          success: false,
          message:
            "Something went wrong sending your message. Please try again.",
        };
      }

      return {
        success: true,
        message: "Form submitted successfully",
      };
    } catch (error) {
      console.error("Contact form: failed to reach Resend", error);
      return {
        success: false,
        message: "Something went wrong sending your message. Please try again.",
      };
    }
  });
