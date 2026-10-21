$ErrorActionPreference = "Stop"

$docxPath = "c:\Users\91959\Documents\Agent Sentinel\AgentSentinel\AgentSentinel_MTech_SE_Final_Project_Report.docx"
$pdfPath = "c:\Users\91959\Documents\Agent Sentinel\AgentSentinel\AgentSentinel_MTech_SE_Final_Project_Report.pdf"

Write-Host "Checking DOCX existence: $docxPath"
if (-not (Test-Path $docxPath)) {
    Write-Error "DOCX file does not exist at $docxPath"
}

Write-Host "Initializing Microsoft Word COM Object..."
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

try {
    Write-Host "Opening DOCX document..."
    $doc = $word.Documents.Open($docxPath, $false, $false)

    Write-Host "Updating document fields (TOC, page numbers)..."
    try {
        $doc.Fields.Update() | Out-Null
    } catch {
        Write-Warning "Fields.Update() returned: $_"
    }

    Write-Host "Updating TOC and Table of Figures / Tables..."
    foreach ($toc in $doc.TablesOfContents) {
        try { $toc.Update() } catch {}
    }
    foreach ($tof in $doc.TablesOfFigures) {
        try { $tof.Update() } catch {}
    }

    Write-Host "Repaginating document..."
    $doc.Repaginate()

    Write-Host "Saving updated DOCX..."
    $doc.Save()

    Write-Host "Exporting to PDF: $pdfPath..."
    # wdFormatPDF = 17
    $wdFormatPDF = 17
    $doc.SaveAs([ref]$pdfPath, [ref]$wdFormatPDF)

    Write-Host "Successfully exported PDF!"
}
finally {
    if ($doc) {
        $doc.Close([ref]$false)
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
    }
    if ($word) {
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Checking PDF output..."
if (Test-Path $pdfPath) {
    $pdfSize = (Get-Item $pdfPath).Length / 1MB
    Write-Host ("PDF created successfully! Size: {0:N2} MB" -f $pdfSize)
} else {
    Write-Error "PDF export failed: file not found"
}
