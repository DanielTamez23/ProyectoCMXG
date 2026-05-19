param(
    [Parameter(Mandatory=$true)]
    [string]$ExcelPath,
    [string]$ApiUrl = "http://localhost:8000/upload",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -Path $ExcelPath)) {
    Write-Host "ERROR: File not found: $ExcelPath" -ForegroundColor Red
    exit 1
}

$ext = [System.IO.Path]::GetExtension($ExcelPath).ToLower()
if ($ext -ne ".xlsx" -and $ext -ne ".xlsm") {
    Write-Host "ERROR: Only .xlsx or .xlsm files are supported" -ForegroundColor Red
    exit 1
}

$curlArgs = @("-s", "-w", "`n%{http_code}", "-X", "POST", $ApiUrl, "-F", "file=@`"$ExcelPath`"")
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
    $curlArgs += @("-H", "x-api-key: $ApiKey")
}

$raw = & curl.exe @curlArgs 2>&1
$lines = $raw -split "`n"
$httpCode = $lines[-1].Trim()
$body = ($lines[0..($lines.Length - 2)] -join "`n").Trim()

if ($httpCode -match "^2") {
    Write-Host "OK: Upload successful -> $body" -ForegroundColor Green
    exit 0
} else {
    Write-Host "ERROR: HTTP $httpCode -> $body" -ForegroundColor Red
    exit 1
}
