"use client";

import type { KeyboardEvent } from "react";

export default function NfcCardInput({ defaultValue }: { defaultValue: string }) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Many card readers send Enter after the card number. Keep the value in
    // the field so an administrator can submit the form with Save Changes.
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <input
      className="input"
      name="nfcCardNumber"
      defaultValue={defaultValue}
      placeholder="Tap NFC card on reader"
      autoComplete="off"
      inputMode="text"
      onKeyDown={handleKeyDown}
    />
  );
}
