<#
.SYNOPSIS
Chạy website Razor Pages và API PetNoVa bằng một lệnh.

.DESCRIPTION
ASP.NET Core dựng các trang Razor trong Pages/, phục vụ CSS/JS từ website/
và API tại cùng một địa chỉ. Không cần npm, Vite hoặc React.
Nhấn Ctrl+C để dừng.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDirectory = Join-Path $projectRoot 'backend\PetNoVaApi'
$razorIndex = Join-Path $apiDirectory 'Pages\Index.cshtml'
$url = 'http://127.0.0.1:5200/'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host 'Không tìm thấy .NET SDK. Cài .NET 10 SDK rồi mở lại VS Code.' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath $razorIndex)) {
    Write-Host 'Không tìm thấy Pages/Index.cshtml.' -ForegroundColor Red
    exit 1
}

$socket = [System.Net.Sockets.TcpClient]::new()
$portBusy = $false
try {
    $socket.Connect('127.0.0.1', 5200)
    $portBusy = $true
}
catch [System.Net.Sockets.SocketException] { }
finally { $socket.Dispose() }

if ($portBusy) {
    try {
        $existing = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
        if ($existing.StatusCode -eq 200 -and $existing.Content -like '*PetNoVa*') {
            Write-Host "Website đã chạy sẵn tại $url" -ForegroundColor Green
            exit 0
        }
    }
    catch { }
    throw 'Cổng 5200 đang được chương trình khác sử dụng. Hãy dừng chương trình đó rồi chạy lại.'
}

Write-Host 'PetNoVa: Razor Pages + CSS/JavaScript + API .NET' -ForegroundColor Cyan
Write-Host "Mở trình duyệt: $url" -ForegroundColor Green
Write-Host 'Giữ terminal này mở. Nhấn Ctrl+C để dừng.' -ForegroundColor DarkGray
Push-Location $apiDirectory
try {
    & dotnet run --launch-profile http
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally { Pop-Location }
