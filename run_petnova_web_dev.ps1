<#!
.SYNOPSIS
Khởi động môi trường phát triển PetNoVa Web bằng một lệnh.

.DESCRIPTION
Tự chạy PetNoVa API ở nền nếu endpoint /health chưa sẵn sàng, sau đó chạy
Vite cho React ở terminal hiện tại. Nhấn Ctrl+C chỉ dừng Vite; API vẫn chạy
ở nền để lần mở web tiếp theo không cần khởi động lại.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDirectory = Join-Path $projectRoot 'backend\PetNoVaApi'
$webDirectory = Join-Path $projectRoot 'web-react'
$healthUrl = 'http://127.0.0.1:5200/health'
$logDirectory = Join-Path $projectRoot '.dev-logs'

function Write-Step {
    param([string]$Message)
    Write-Host "[PetNoVa Web] $Message" -ForegroundColor Cyan
}

function Test-ApiReady {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

try {
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        throw 'Không tìm thấy .NET SDK. Hãy cài .NET 10 SDK rồi mở lại VS Code.'
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw 'Không tìm thấy npm. Hãy cài Node.js LTS rồi mở lại VS Code.'
    }

    if (-not (Test-Path -LiteralPath $apiDirectory)) {
        throw "Không tìm thấy backend tại $apiDirectory"
    }

    if (-not (Test-Path -LiteralPath $webDirectory)) {
        throw "Không tìm thấy website React tại $webDirectory"
    }

    if (-not (Test-ApiReady)) {
        New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
        $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $standardOutputLog = Join-Path $logDirectory "api_$timestamp.log"
        $standardErrorLog = Join-Path $logDirectory "api_$timestamp.error.log"

        Write-Step 'Đang khởi động API .NET tại cổng 5200...'
        $apiProcess = Start-Process `
            -FilePath (Get-Command dotnet).Source `
            -ArgumentList @('run', '--launch-profile', 'http', '--no-restore') `
            -WorkingDirectory $apiDirectory `
            -WindowStyle Hidden `
            -RedirectStandardOutput $standardOutputLog `
            -RedirectStandardError $standardErrorLog `
            -PassThru

        $ready = $false
        for ($second = 1; $second -le 45; $second++) {
            Start-Sleep -Seconds 1
            if ($apiProcess.HasExited) {
                throw "API đã dừng khi khởi động. Xem log: $standardOutputLog"
            }
            if (Test-ApiReady) {
                $ready = $true
                break
            }
        }

        if (-not $ready) {
            throw "API chưa sẵn sàng sau 45 giây. Xem log: $standardOutputLog"
        }
    }

    Write-Host '  ✓ API đã sẵn sàng: http://127.0.0.1:5200' -ForegroundColor Green

    Push-Location $webDirectory
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $webDirectory 'node_modules'))) {
            Write-Step 'Đang cài các package React (chỉ cần ở lần đầu)...'
            & npm install
            if ($LASTEXITCODE -ne 0) {
                throw 'npm install thất bại.'
            }
        }

        Write-Step 'Đang chạy website tại http://localhost:5173'
        Write-Host '  Nhấn Ctrl+C để dừng website; API vẫn chạy nền.' -ForegroundColor DarkGray
        & npm run dev
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host "[PetNoVa Web] Lỗi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
