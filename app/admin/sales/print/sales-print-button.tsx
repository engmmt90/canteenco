"use client";

export default function SalesPrintButton() {
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
