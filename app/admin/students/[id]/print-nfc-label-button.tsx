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
    const safeClass = escapeHtml(className);
    const safeNfc = escapeHtml(nfcCardNumber);

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NFC Label - ${safeName}</title>
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }

    html,
    body {
      width: 50mm;
      height: 30mm;
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: Arial, sans-serif;
    }

    .label {
      width: 50mm;
      height: 30mm;
      box-sizing: border-box;
      padding: 2.5mm 3mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
    }

    .name {
      font-size: 14pt;
      font-weight: 800;
      line-height: 1.05;
      margin-bottom: 1.8mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row {
      font-size: 10pt;
      font-weight: 700;
      line-height: 1.2;
    }

    .nfc {
      margin-top: 1.2mm;
      font-size: 8.5pt;
      line-height: 1.15;
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
