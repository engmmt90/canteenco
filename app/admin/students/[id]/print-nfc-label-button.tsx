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
      "width=520,height=420",
    );

    if (!printWindow) {
      window.alert(
        "Please allow pop-ups to print the NFC label.",
      );
      return;
    }

    const safeName = escapeHtml(studentName);
    const safeClass = escapeHtml(className);
    const safeNfc = escapeHtml(nfcCardNumber);

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NFC Label - ${safeName}</title>
  <style>
    @page {
      size: 80mm 32mm;
      margin: 0;
    }

    html,
    body {
      width: 80mm;
      height: 32mm;
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: Arial, sans-serif;
    }

    .label {
      width: 80mm;
      height: 32mm;
      box-sizing: border-box;
      padding: 3mm 5mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
    }

    .name {
      font-size: 18pt;
      font-weight: 800;
      line-height: 1.05;
      margin-bottom: 2mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row {
      font-size: 11pt;
      font-weight: 700;
      line-height: 1.25;
    }

    .nfc {
      margin-top: 1mm;
      font-size: 9pt;
      font-family: Arial, sans-serif;
      overflow-wrap: anywhere;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="name">${safeName}</div>
    <div class="row">Class: ${safeClass}</div>
    <div class="nfc">NFC: ${safeNfc}</div>
  </div>
  <script>
    window.addEventListener("load", function () {
      window.print();
      window.setTimeout(function () {
        window.close();
      }, 250);
    });
  </script>
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
