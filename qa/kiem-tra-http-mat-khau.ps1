[CmdletBinding()]
param([string]$BaseUrl = 'http://127.0.0.1:5200')
$ErrorActionPreference = 'Stop'
if ($BaseUrl -notmatch '^http://(127\.0\.0\.1|localhost):\d+$') { throw 'Chỉ kiểm thử API loopback.' }
Add-Type -AssemblyName System.Net.Http

# Tất cả request dùng phiên/token giả; không đổi mật khẩu của tài khoản thật.
$cases = @(
    @{id='short';password='Aa1!';message='12'},
    @{id='missing-upper';password='abcdefghij1!';message='chữ hoa'},
    @{id='missing-lower';password='ABCDEFGHIJ1!';message='chữ thường'},
    @{id='missing-digit';password='Abcdefghijk!';message='chữ số'},
    @{id='missing-symbol';password='Abcdefghij12';message='đặc biệt'},
    @{id='unicode';password='Abcdefgh1!Đa';message='không dấu'},
    @{id='too-long';password=('Ab1!' + ('x' * 125));message='128'},
    @{id='valid-password-invalid-session';password='Abcdefghi1!X';message='phiên|hết hạn'}
)
$results = @()
$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(10)
try {
    foreach ($case in $cases) {
        $payload = @{challengeId='00000000-0000-0000-0000-000000000000';resetToken='qa-not-a-real-reset-token';newPassword=$case.password} | ConvertTo-Json -Compress
        $content = [System.Net.Http.StringContent]::new($payload, [Text.Encoding]::UTF8, 'application/json')
        $response = $null
        try {
            $response = $client.PostAsync($BaseUrl + '/api/auth/password-reset/complete', $content).GetAwaiter().GetResult()
            $status = [int]$response.StatusCode
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            $message = [string]$body.message
            $passed = $status -eq 400 -and $message -match $case.message
            $results += [pscustomobject]@{id=$case.id;actualStatus=$status;message=$message;status=if($passed){'PASS'}else{'FAIL'}}
            Write-Output "$($results[-1].status) $($case.id): HTTP $status"
        }
        finally {
            if ($null -ne $response) { $response.Dispose() }
            $content.Dispose()
        }
    }
}
finally { $client.Dispose() }

$report = [ordered]@{executedAtUtc=[DateTime]::UtcNow.ToString('o');baseUrl=$BaseUrl;passed=@($results|Where-Object status -eq 'PASS').Count;failed=@($results|Where-Object status -eq 'FAIL').Count;results=$results}
$destination = Join-Path $PSScriptRoot 'results\mat-khau-http.json'
[IO.File]::WriteAllText($destination, ($report | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
if ($report.failed -gt 0) { exit 1 }
