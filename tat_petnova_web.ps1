<#
.SYNOPSIS
Dừng website React và API PetNoVa, kể cả khi chạy ở terminal khác.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$webModules = Join-Path $projectRoot 'web-react\node_modules\'
$apiBin = Join-Path $projectRoot 'backend\PetNoVaApi\bin\'

function Test-PetNovaProcess {
    param($Process, [int]$Port)

    if ($Port -eq 5173) {
        $commandLine = ([string]$Process.CommandLine).Replace('/', '\')
        return $Process.Name -ieq 'node.exe' -and
            $commandLine.IndexOf($webModules, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            $commandLine -match '\\vite\\bin\\vite\.js(?:["\s]|$)'
    }

    $executable = [string]$Process.ExecutablePath
    return $Port -eq 5200 -and $Process.Name -ieq 'PetNoVaApi.exe' -and
        $executable.StartsWith($apiBin, [StringComparison]::OrdinalIgnoreCase)
}

try {
    $targets = @(foreach ($port in @(5173, 5200)) {
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
        foreach ($listener in $listeners) {
            $processInfo = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess)
            if ($null -eq $processInfo) { continue }
            if (Test-PetNovaProcess -Process $processInfo -Port $port) {
                [pscustomobject]@{ Port = $port; Process = $processInfo }
            }
            else {
                Write-Warning "Cổng $port thuộc tiến trình khác; hãy kiểm tra ứng dụng đang dùng cổng này."
            }
        }
    })

    $targets = @($targets | Sort-Object { $_.Process.ProcessId } -Unique)
    if ($targets.Count -eq 0) {
        Write-Host '[PetNoVa] Không tìm thấy phiên web/API PetNoVa đang chạy.' -ForegroundColor Cyan
    }

    foreach ($target in $targets) {
        # Kiểm tra lại PID và thời điểm tạo trước khi dừng để tránh nhầm tiến trình.
        $processInfo = $target.Process
        $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $processInfo.ProcessId)
        if ($null -eq $current) { continue }
        if ($current.CreationDate -ne $processInfo.CreationDate -or
            -not (Test-PetNovaProcess -Process $current -Port $target.Port)) {
            throw "Tiến trình tại cổng $($target.Port) đã thay đổi; hãy chạy lại lệnh tắt."
        }

        Stop-Process -Id $current.ProcessId -ErrorAction Stop
        $name = if ($target.Port -eq 5173) { 'website React' } else { 'API .NET' }
        Write-Host "[PetNoVa] Đã dừng $name (cổng $($target.Port))." -ForegroundColor Green
    }
}
catch {
    Write-Host "[PetNoVa] Lỗi khi tắt web: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
