"use client";

import { useActionState, useState } from "react";
import { createTopUpRequest, type TopUpFormState } from "@/app/actions/topups";

const initialState: TopUpFormState = {};
const presets = [5, 10, 20, 50, 100];

export function TopUpForm() {
  const [state, formAction, pending] = useActionState(createTopUpRequest, initialState);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState("20");

  return (
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

      <p className="subtle compact">Submitting this request does not change your balance. Your family wallet is credited only after the administrator confirms the cash payment.</p>
      {state.error ? <p className="alert">{state.error}</p> : null}
      {state.success ? <p className="success">{state.success}</p> : null}
      <button className="primary" disabled={pending} type="submit">{pending ? "Submitting…" : "Request Top-Up"}</button>
    </form>
  );
}
