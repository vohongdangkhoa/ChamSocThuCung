<#!
.SYNOPSIS
Khởi động môi trường phát triển PetNoVa Web bằng một lệnh.

.DESCRIPTION
Chạy PetNoVa API và website React bằng một lệnh. API do script khởi động
sẽ được dừng cùng website để lần chạy sau luôn dùng mã nguồn mới.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDirectory = Join-Path $projectRoot 'backend\PetNoVaApi'
$webDirectory = Join-Path $projectRoot 'web-react'
$healthUrl = 'http://127.0.0.1:5200/health'
$webUrl = 'http://localhost:5173/'
$logDirectory = Join-Path $projectRoot '.dev-logs'
$apiProcess = $null

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

function Get-ApiFailureDetails {
    param([string]$OutputLog, [string]$ErrorLog)

    $lines = @()
    foreach ($path in @($ErrorLog, $OutputLog)) {
        if (Test-Path -LiteralPath $path) {
            $lines += Get-Content -LiteralPath $path -Tail 12 -ErrorAction SilentlyContinue
        }
    }
    $details = ($lines | Where-Object { $_ -and $_.Trim() } | Select-Object -Last 12) -join [Environment]::NewLine
    if ($details) {
        return "$details`nLog đầy đủ: $OutputLog và $ErrorLog"
    }
    return "Xem log: $OutputLog và $ErrorLog"
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

    $existingWeb = $null
    try {
        $existingWeb = Invoke-WebRequest -UseBasicParsing -Uri $webUrl -TimeoutSec 3
    }
    catch {
        # Chưa có website đang phục vụ tại cổng 5173.
    }
    if ($null -ne $existingWeb) {
        if ($existingWeb.Content -notmatch '<title>PetNoVa</title>') {
            throw 'Cổng 5173 đang bị ứng dụng khác chiếm. Hãy dừng ứng dụng đó rồi chạy lại.'
        }
        if (-not (Test-ApiReady)) {
            throw 'Website PetNoVa đã chạy tại cổng 5173 nhưng API chưa chạy. Hãy dừng terminal Vite cũ bằng Ctrl+C rồi chạy lại lệnh này.'
        }
        Write-Step "PetNoVa đã chạy sẵn tại $webUrl. Không cần mở thêm phiên Vite."
        return
    }

    if (-not (Test-ApiReady)) {
        New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
        $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $standardOutputLog = Join-Path $logDirectory "api_$timestamp.log"
        $standardErrorLog = Join-Path $logDirectory "api_$timestamp.error.log"

        Write-Step 'Đang khởi động API .NET tại cổng 5200...'
        $apiProcess = Start-Process `
            -FilePath (Get-Command dotnet).Source `
            -ArgumentList @('run', '--launch-profile', 'http') `
            -WorkingDirectory $apiDirectory `
            -WindowStyle Hidden `
            -RedirectStandardOutput $standardOutputLog `
            -RedirectStandardError $standardErrorLog `
            -PassThru

        $ready = $false
        for ($second = 1; $second -le 60; $second++) {
            Start-Sleep -Seconds 1
            $apiProcess.Refresh()
            if ($apiProcess.HasExited) {
                throw "API đã dừng khi khởi động.`n$(Get-ApiFailureDetails $standardOutputLog $standardErrorLog)"
            }
            if (Test-ApiReady) {
                $ready = $true
                break
            }
        }

        if (-not $ready) {
            throw "API chưa sẵn sàng sau 60 giây.`n$(Get-ApiFailureDetails $standardOutputLog $standardErrorLog)"
        }
    }
    else {
        Write-Host '  API đã chạy sẵn ở cổng 5200; đang dùng phiên API đó.' -ForegroundColor Yellow
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
        Write-Host '  Giữ terminal này mở. Nhấn Ctrl+C để dừng website và API do script mở.' -ForegroundColor DarkGray
        & npm run dev
        if ($LASTEXITCODE -ne 0) {
            throw "Vite đã dừng với mã lỗi $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host "[PetNoVa Web] Lỗi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if ($null -ne $apiProcess) {
        $apiProcess.Refresh()
        if (-not $apiProcess.HasExited) {
            Stop-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue
            Write-Step 'Đã dừng API do script khởi động.'
        }
    }
}
