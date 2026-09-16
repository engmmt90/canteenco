Add-Type @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOC_INFO_1
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDatatype;
    }

    [DllImport("winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true)]
    private static extern bool OpenPrinter(
        string pPrinterName,
        out IntPtr phPrinter,
        IntPtr pDefault
    );

    [DllImport("winspool.drv",
        SetLastError = true)]
    private static extern bool ClosePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.drv",
        CharSet = CharSet.Unicode,
        SetLastError = true)]
    private static extern int StartDocPrinter(
        IntPtr hPrinter,
        int Level,
        ref DOC_INFO_1 pDocInfo
    );

    [DllImport("winspool.drv",
        SetLastError = true)]
    private static extern bool EndDocPrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.drv",
        SetLastError = true)]
    private static extern bool StartPagePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.drv",
        SetLastError = true)]
    private static extern bool EndPagePrinter(
        IntPtr hPrinter
    );

    [DllImport("winspool.drv",
        SetLastError = true)]
    private static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten
    );

    public static void Send(
        string printerName,
        byte[] bytes
    )
    {
        IntPtr printer;

        if (!OpenPrinter(
            printerName,
            out printer,
            IntPtr.Zero
        ))
        {
            throw new Win32Exception(
                Marshal.GetLastWin32Error()
            );
        }

        try
        {
            DOC_INFO_1 doc =
                new DOC_INFO_1
                {
                    pDocName =
                        "CanteenCo Cash Drawer",
                    pOutputFile = null,
                    pDatatype = "RAW"
                };

            if (
                StartDocPrinter(
                    printer,
                    1,
                    ref doc
                ) == 0
            )
            {
                throw new Win32Exception(
                    Marshal.GetLastWin32Error()
                );
            }

            try
            {
                if (!StartPagePrinter(printer))
                {
                    throw new Win32Exception(
                        Marshal.GetLastWin32Error()
                    );
                }

                try
                {
                    IntPtr unmanaged =
                        Marshal.AllocCoTaskMem(
                            bytes.Length
                        );

                    try
                    {
                        Marshal.Copy(
                            bytes,
                            0,
                            unmanaged,
                            bytes.Length
                        );

                        int written;

                        if (
                            !WritePrinter(
                                printer,
                                unmanaged,
                                bytes.Length,
                                out written
                            )
                        )
                        {
                            throw new Win32Exception(
                                Marshal.GetLastWin32Error()
                            );
                        }
                    }
                    finally
                    {
                        Marshal.FreeCoTaskMem(
                            unmanaged
                        );
                    }
                }
                finally
                {
                    EndPagePrinter(printer);
                }
            }
            finally
            {
                EndDocPrinter(printer);
            }
        }
        finally
        {
            ClosePrinter(printer);
        }
    }
}
"@

$printerName = "AURES ODP333"

# ESC p 1
# Drawer #2 — this is the output that worked
# with your current printer setup.
$drawerCommand = [byte[]](
    0x1B,
    0x70,
    0x01,
    0x19,
    0xFA
)

[RawPrinter]::Send(
    $printerName,
    $drawerCommand
)

Write-Host "Cash drawer command sent successfully."