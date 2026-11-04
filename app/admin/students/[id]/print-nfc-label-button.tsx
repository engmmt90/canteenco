"use client";

type Props = {
  studentName: string;
  className: string;
  nfcCardNumber: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function PrintNfcLabelButton({
  studentName,
  className,
  nfcCardNumber,
}: Props) {
  function printLabel() {
    const printWindow = window.open(
      "",
      "_blank",
      "width=420,height=320",
    );

    if (!printWindow) {
      window.alert(
        "Please allow pop-ups to print the NFC label.",
      );
      return;
    }

    const safeName = escapeHtml(studentName);
    const nameLength = studentName.trim().length;
    const longestWordLength = Math.max(0, ...studentName.trim().split(/\s+/).map((word) => word.length));
    const nameSizeClass = nameLength > 28 || longestWordLength > 16
      ? "name very-long"
      : nameLength > 20 || longestWordLength > 11
        ? "name long"
        : "name";
    const safeClass = escapeHtml(className);
    const safeNfc = escapeHtml(nfcCardNumber);

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NFC Label - ${safeName}</title>
  <style>
    @page {
      size: 56mm 50.8mm;
      margin: 0;
    }

    html,
    body {
      width: 56mm;
      height: 50.8mm;
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: Arial, sans-serif;
    }

    .toolbar { padding: 12px; font: 14px Arial, sans-serif; }
    .toolbar button { padding: 8px 14px; cursor: pointer; }

    .label {
      width: 56mm;
      height: 50.8mm;
      box-sizing: border-box;
      padding: 6mm 9mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      overflow: hidden;
    }

    .label > * {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      position: relative;
      left: 3mm;
    }

    .name {
      font-size: 15pt;
      font-weight: 800;
      line-height: 1.05;
      margin-bottom: 0;
      overflow-wrap: normal;
    }

    .name.long { font-size: 11pt; }
    .name.very-long { font-size: 9pt; overflow-wrap: anywhere; }

    .row {
      font-size: 12pt;
      font-weight: 700;
      line-height: 1.2;
    }

    .nfc {
      margin-top: 0;
      font-size: 10pt;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }

    @media print {
      .toolbar { display: none; }
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Print label</button> Select the label printer in the print dialog.</div>
  <div class="label">
    <div class="${nameSizeClass}">${safeName}</div>
    <div class="row">Class: ${safeClass}</div>
    <div class="nfc">NFC: ${safeNfc}</div>
  </div>
  
</body>
</html>`);

    printWindow.document.close();
  }

  return (
    <button
      type="button"
      className="secondary"
      onClick={printLabel}
    >
      Print NFC Label
    </button>
  );
}
