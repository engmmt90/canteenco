"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  submitContactForm,
  type ContactFormState,
} from "@/app/actions/contact";

const initialState: ContactFormState = {
  ok: false,
};

export default function ParentContactPage() {
  const [state, formAction, pending] =
    useActionState(
      submitContactForm,
      initialState,
    );

  return (
    <main className="shell">
      <section className="card registration-card">
        <div className="page-heading">
          <div>
            <h1 className="brand">
              Contact Us
            </h1>

            <p className="subtle">
              Need help with your CanteenCo
              account, wallet, orders, or
              children? We are here to help.
            </p>
          </div>

          <Link
            className="secondary"
            href="/"
          >
            Back to Sign In
          </Link>
        </div>

        <div className="divider" />

        <div
          className="panel"
          style={{
            marginBottom: 16,
          }}
        >
          <h2>WhatsApp Support</h2>

          <p className="subtle">
            Contact CanteenCo Support directly
            on WhatsApp.
          </p>

          <a
            className="primary"
            href="https://wa.me/61451825151"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chat with us on WhatsApp
          </a>
        </div>

        <div className="divider" />

        <div className="panel">
          <h2>Send us a message</h2>

          <p className="subtle">
            Complete the form below and our
            support team will receive your
            message.
          </p>

          <form
            action={formAction}
            className="form"
          >
            <label className="label">
              Name

              <input
                className="input"
                type="text"
                name="name"
                maxLength={120}
                required
                placeholder="Your name"
              />
            </label>

            <label className="label">
              Email

              <input
                className="input"
                type="email"
                name="email"
                maxLength={200}
                required
                placeholder="you@example.com"
              />
            </label>

            <label className="label">
              Subject

              <input
                className="input"
                type="text"
                name="subject"
                maxLength={200}
                required
                placeholder="How can we help?"
              />
            </label>

            <label className="label">
              Message

              <textarea
                className="input"
                name="message"
                maxLength={5000}
                required
                rows={7}
                placeholder="Please describe how we can help..."
                style={{
                  resize: "vertical",
                  minHeight: 150,
                }}
              />
            </label>

            {state.error ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#b91c1c",
                }}
              >
                {state.error}
              </p>
            ) : null}

            {state.success ? (
              <p
                role="status"
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 8,
                  background: "#f0fdf4",
                  color: "#15803d",
                }}
              >
                {state.success}
              </p>
            ) : null}

            <button
              className="primary"
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Sending..."
                : "Send Message"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}