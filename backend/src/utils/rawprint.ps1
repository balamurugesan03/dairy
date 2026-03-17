# rawprint.ps1 — Send raw ESC/POS bytes to a Windows printer via winspool.drv
# Usage: powershell -File rawprint.ps1 -FilePath "C:\tmp\job.bin" -PrinterName "Everycom EC58"
param(
  [string]$FilePath,
  [string]$PrinterName
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOC_INFO_1 {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint="OpenPrinterA",    SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", EntryPoint="ClosePrinter")]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int Level,
        [In][MarshalAs(UnmanagedType.LPStruct)] DOC_INFO_1 pDocInfo);

    [DllImport("winspool.drv", EntryPoint="EndDocPrinter")]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="StartPagePrinter")]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="EndPagePrinter")]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBuf, int cbBuf, out int pcWritten);

    public static bool Print(string printerName, byte[] data) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            Console.Error.WriteLine("OpenPrinter failed. Is the printer name correct?");
            return false;
        }
        var di = new DOC_INFO_1 { pDocName = "ESCPOS-RAW", pDataType = "RAW" };
        if (StartDocPrinter(hPrinter, 1, di) == 0) {
            ClosePrinter(hPrinter);
            Console.Error.WriteLine("StartDocPrinter failed.");
            return false;
        }
        StartPagePrinter(hPrinter);
        var ptr = Marshal.AllocHGlobal(data.Length);
        Marshal.Copy(data, 0, ptr, data.Length);
        int written = 0;
        bool ok = WritePrinter(hPrinter, ptr, data.Length, out written);
        Marshal.FreeHGlobal(ptr);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return ok;
    }
}
"@ -ErrorAction Stop

$bytes  = [System.IO.File]::ReadAllBytes($FilePath)
$result = [RawPrint]::Print($PrinterName, $bytes)

if (-not $result) {
    Write-Error "RawPrint failed for printer: $PrinterName"
    exit 1
}
exit 0
