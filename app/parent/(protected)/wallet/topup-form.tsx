"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createTopUpRequest, type TopUpFormState } from "@/app/actions/topups";

const initialState: TopUpFormState = {};
const presets = [5, 10, 20, 50, 100];

export function TopUpForm() {
  const [state, formAction, pending] = useActionState(createTopUpRequest, initialState);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState("20");
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  return (
    <>
      {!noticeAccepted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="topup-payment-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(17, 24, 39, 0.45)",
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(460px, 100%)",
              margin: 0,
              padding: 22,
            }}
          >
            <h2 id="topup-payment-title" style={{ marginTop: 0 }}>
              Payment Required Before Top-Up
            </h2>

            <p>Please arrange payment before submitting a top-up request.</p>

            <p>
              Payment can be made at the school canteen, or you can contact the
              Canteen Admin through{" "}
              <Link href="/parent/contact" style={{ fontWeight: 700 }}>
                Contact Us
              </Link>{" "}
              to arrange an alternative payment method.
            </p>

            <p className="subtle">
              Your wallet balance will be updated once the payment has been
              received and the top-up request has been approved.
            </p>

            <button
              className="primary"
              type="button"
              onClick={() => setNoticeAccepted(true)}
              style={{ width: "100%" }}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      <form className="form" action={formAction}>
      <input type="hidden" name="amountMode" value={mode} />
      <input type="hidden" name="presetAmount" value={preset} />

      <div>
        <div className="label" style={{ marginBottom: 8 }}>Choose amount</div>
        <div className="amount-options">
          {presets.map((amount) => (
            <button
              className={mode === "preset" && preset === String(amount) ? "amount-chip amount-chip-active" : "amount-chip"}
              key={amount}
              onClick={() => { setMode("preset"); setPreset(String(amount)); }}
              type="button"
            >
              ${amount}
            </button>
          ))}
          <button
            className={mode === "custom" ? "amount-chip amount-chip-active" : "amount-chip"}
            onClick={() => setMode("custom")}
            type="button"
          >
            Other
          </button>
        </div>
      </div>

      {mode === "custom" ? (
        <label className="label">
          Other amount (AUD)
          <input className="input" inputMode="decimal" min="1" max="1000" name="customAmount" placeholder="25.00" step="0.01" type="number" required />
        </label>
      ) : null}

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={paymentConfirmed}
          onChange={(event) => setPaymentConfirmed(event.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          I confirm that payment has been made or arranged with the Canteen Admin.
        </span>
      </label>

      <p className="subtle compact">
        Submitting this request does not change your balance. Your family wallet
        is credited only after payment is received and the request is approved.
      </p>
      {state.error ? <p className="alert">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}
      <button className="primary" disabled={pending || !paymentConfirmed} type="submit">{pending ? "Submitting…" : "Request Top-Up"}</button>
      </form>
    </>
  );
}
