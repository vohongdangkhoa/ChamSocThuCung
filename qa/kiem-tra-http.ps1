[CmdletBinding()]
param([string]$BaseUrl = 'http://127.0.0.1:5200')
$ErrorActionPreference = 'Stop'
if ($BaseUrl -notmatch '^http://(127\.0\.0\.1|localhost):\d+$') { throw 'Chi kiem thu API loopback.' }
$results = @()
function Check-Response {
    param([string]$Id,[string]$Path,[int]$Expected,[string]$Method='GET',[object]$Body=$null,[hashtable]$Headers=@{})
    $actual = 0
    try {
        $arguments = @{Uri=($BaseUrl+$Path);Method=$Method;TimeoutSec=20;UseBasicParsing=$true;Headers=$Headers}
        if ($null -ne $Body) { $arguments.Body = $Body | ConvertTo-Json -Compress; $arguments.ContentType='application/json' }
        $response = Invoke-WebRequest @arguments
        $actual = [int]$response.StatusCode
    } catch {
        if ($null -ne $_.Exception.Response) { $actual = [int]$_.Exception.Response.StatusCode }
    }
    $script:results += [pscustomobject]@{id=$Id;method=$Method;path=$Path;expected=$Expected;actual=$actual;status=if($actual -eq $Expected){'PASS'}else{'FAIL'}}
    Write-Output "$($script:results[-1].status) $Id $Path : $actual"
}
Check-Response 'HTTP-health' '/health' 200
foreach ($path in @('/api/Pets','/api/Bookings','/api/BookingDetails','/api/Payments','/api/UserAccounts',
    '/api/Staffs','/api/ServicePackages','/api/ServiceCategories','/api/Reports','/api/AuditLogs',
    '/api/MedicalRecords','/api/Vaccinations','/api/Notifications/user/QA-NONE')) {
    Check-Response 'F12_01' $path 401
}
Check-Response 'F12_01-invalid-token' '/api/Pets' 401 -Headers @{Authorization='Bearer qa-invalid-token-not-a-credential'}
Check-Response 'F1.5_02' '/api/auth/password-reset/request' 400 -Method POST -Body @{phone='abc'}
Check-Response 'F1.6_03-invalid-session' '/api/auth/password-reset/verify' 400 -Method POST -Body @{challengeId='00000000-0000-0000-0000-000000000000';otp='123456'}
Check-Response 'F1.7_04-invalid-session' '/api/auth/password-reset/complete' 400 -Method POST -Body @{challengeId='00000000-0000-0000-0000-000000000000';resetToken='invalid-test-token';newPassword='not-a-real-account-password'}
Check-Response 'F5.2_03-invalid-signature' '/api/Payments/payos-webhook' 400 -Method POST -Body @{code='00';desc='QA invalid';success=$true;signature='qa-invalid-signature';data=@{orderCode=0;amount=0;description='QA';accountNumber='';reference='QA';transactionDateTime='2026-01-01 00:00:00';currency='VND';paymentLinkId='QA';code='00';desc='QA'}}
$destination = Join-Path $PSScriptRoot 'results\http.json'
$report = [ordered]@{executedAtUtc=[DateTime]::UtcNow.ToString('o');baseUrl=$BaseUrl;passed=@($results|Where-Object status -eq 'PASS').Count;failed=@($results|Where-Object status -ne 'PASS').Count;results=$results}
[IO.File]::WriteAllText($destination,($report|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
if ($report.failed -gt 0) { exit 1 }
