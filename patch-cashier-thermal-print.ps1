$path = "app\cashier\cashier-client.tsx"

if (-not (Test-Path $path)) {
  throw "File not found: $path"
}

$content = [System.IO.File]::ReadAllText($path)

$pattern = '(?s)<style>\{`.*?\.print-label\s*\{.*?</style>'

$replacement = @'
<style>{`
        .print-label {
          display: none;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            width: 80mm !important;
            min-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-label,
          .print-label * {
            visibility: visible !important;
          }

          .print-label {
            display: block !important;
            position: static !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 80mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 3mm 4mm !important;
            background: white !important;
            color: black !important;
            font-family: Arial, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
        }
      `}</style>
'@

$updated = [System.Text.RegularExpressions.Regex]::Replace(
  $content,
  $pattern,
  $replacement,
  1
)

if ($updated -eq $content) {
  throw "Print style block was not found. No changes were made."
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $updated, $utf8NoBom)

Write-Host "Thermal print CSS updated successfully."
Write-Host "Staff Attendance and recent-sale Print code were left untouched."
