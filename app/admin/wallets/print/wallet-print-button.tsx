"use client";

export default function WalletPrintButton() {
  return (
    <button
      className="primary"
      type="button"
      onClick={() =>
        window.print()
      }
    >
      Print Report
    </button>
  );
}
