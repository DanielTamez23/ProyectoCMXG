param(
    [string]$WatchFolder = "",
    [string]$ApiUrl = "http://localhost:8000/upload",
    [string]$ApiKey = "",
    [int]$PollSeconds = 5
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($WatchFolder)) {
    Write-Host "ERROR: Debes indicar -WatchFolder con la ruta de tus Excel." -ForegroundColor Red
    exit 1
}

if (!(Test-Path -Path $WatchFolder)) {
    Write-Host "ERROR: La carpeta no existe: $WatchFolder" -ForegroundColor Red
    exit 1
}

$statePath = Join-Path $PSScriptRoot ".excel-upload-state.json"
$state = @{}
if (Test-Path $statePath) {
    try {
        $raw = Get-Content -Path $statePath -Raw
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $loaded = $raw | ConvertFrom-Json
            if ($loaded -and $loaded.PSObject.Properties.Name.Count -gt 0) {
                foreach ($p in $loaded.PSObject.Properties) {
                    $state[$p.Name] = [string]$p.Value
                }
            }
        }
    } catch {
        Write-Host "WARN: No se pudo leer estado previo. Se creara uno nuevo." -ForegroundColor Yellow
    }
}

function Save-State {
    param([hashtable]$Current)
    $json = $Current | ConvertTo-Json -Depth 4
    Set-Content -Path $statePath -Value $json -Encoding UTF8
}

function Test-FileUnlocked {
    param([string]$Path)
    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
        $stream.Close()
        return $true
    } catch {
        return $false
    }
}

function Upload-ExcelFile {
    param(
        [string]$Path,
        [string]$Url,
        [string]$Key
    )

    $client = New-Object System.Net.Http.HttpClient
    try {
        if (-not [string]::IsNullOrWhiteSpace($Key)) {
            $client.DefaultRequestHeaders.Add("x-api-key", $Key)
        }

        $form = New-Object System.Net.Http.MultipartFormDataContent
        $fileStream = [System.IO.File]::OpenRead($Path)
        try {
            $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
            $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            $form.Add($fileContent, "file", [System.IO.Path]::GetFileName($Path))

            $response = $client.PostAsync($Url, $form).Result
            $body = $response.Content.ReadAsStringAsync().Result
            if (-not $response.IsSuccessStatusCode) {
                throw "HTTP $($response.StatusCode): $body"
            }
            return $body
        } finally {
            $fileStream.Dispose()
            $form.Dispose()
        }
    } finally {
        $client.Dispose()
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Excel Auto Upload Watcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "WatchFolder : $WatchFolder"
Write-Host "ApiUrl      : $ApiUrl"
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "ApiKey      : (empty - backend key not required)" -ForegroundColor Yellow
} else {
    Write-Host "ApiKey      : (configurada)" -ForegroundColor Green
}
Write-Host "PollSeconds : $PollSeconds"
Write-Host ""
Write-Host "Monitoreando... Presiona Ctrl+C para salir." -ForegroundColor Green

while ($true) {
    try {
        $files = Get-ChildItem -Path $WatchFolder -Filter *.xlsx -File -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            if (-not (Test-FileUnlocked -Path $file.FullName)) {
                continue
            }

            $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
            $known = $state[$file.FullName]

            if ($known -eq $hash) {
                continue
            }

            Write-Host "[UPLOAD] $($file.Name)" -ForegroundColor Cyan
            $result = Upload-ExcelFile -Path $file.FullName -Url $ApiUrl -Key $ApiKey
            Write-Host "[OK] $($file.Name) -> $result" -ForegroundColor Green

            $state[$file.FullName] = $hash
            Save-State -Current $state
        }
    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds $PollSeconds
}
