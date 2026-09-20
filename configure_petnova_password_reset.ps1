# Script cấu hình SMTP, Firebase Admin và secret bảo mật cho chức năng OTP.
[CmdletBinding()]
param()

# Dừng ngay khi bất kỳ bước xác minh/copy/lưu secret nào thất bại.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Giữ cố định Firebase project để service account tải nhầm không thể đổi mật khẩu app khác.
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendProject = Join-Path $projectRoot 'backend\PetNoVaApi\PetNoVaApi.csproj'
$expectedFirebaseProject = 'pet-care-app-dd27b'

# Sửa file secrets có UTF-8 BOM sai vì dotnet user-secrets yêu cầu JSON hợp lệ.
function Repair-UserSecretsEncoding {
    param([string]$ProjectPath)

    # Đọc UserSecretsId trong csproj để tìm đúng secrets.json của backend hiện tại.
    [xml]$projectXml = Get-Content -LiteralPath $ProjectPath -Raw
    $userSecretsId = @(
        $projectXml.Project.PropertyGroup.UserSecretsId |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    ) | Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($userSecretsId)) {
        throw 'Backend chưa có UserSecretsId.'
    }

    $secretsFile = Join-Path `
        $env:APPDATA `
        "Microsoft\UserSecrets\$userSecretsId\secrets.json"

    # Chưa có file nghĩa dotnet sẽ tự tạo đúng encoding ở lần set đầu tiên.
    if (-not (Test-Path -LiteralPath $secretsFile -PathType Leaf)) {
        return
    }

    $bytes = [IO.File]::ReadAllBytes($secretsFile)
    # Ba byte EF BB BF từng gây JsonReaderException ở đầu file.
    $hasUtf8Bom = `
        $bytes.Length -ge 3 -and `
        $bytes[0] -eq 0xEF -and `
        $bytes[1] -eq 0xBB -and `
        $bytes[2] -eq 0xBF

    if (-not $hasUtf8Bom) {
        return
    }

    # Parse thử trước khi thay file để không ghi đè secrets JSON đang hỏng vì lý do khác.
    $json = [Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    $null = $json | ConvertFrom-Json

    $temporaryFile = Join-Path `
        (Split-Path -Parent $secretsFile) `
        "secrets.$([Guid]::NewGuid().ToString('N')).tmp"

    # Ghi file tạm không BOM rồi move đè giúp thao tác gần như atomic.
    try {
        [IO.File]::WriteAllText(
            $temporaryFile,
            $json,
            [Text.UTF8Encoding]::new($false)
        )
        Move-Item `
            -LiteralPath $temporaryFile `
            -Destination $secretsFile `
            -Force
    }
    finally {
        # Dọn file tạm nếu Write/Move gặp lỗi giữa chừng.
        if (Test-Path -LiteralPath $temporaryFile) {
            Remove-Item -LiteralPath $temporaryFile -Force
        }
    }

    Write-Host '  ✓ Đã chuẩn hóa file .NET User Secrets (không làm mất cấu hình cũ).' -ForegroundColor Green
}

# Hỏi người dùng một cấu hình bắt buộc, không cho tiếp tục với chuỗi rỗng.
function Read-RequiredValue {
    param([string]$Prompt)

    $value = (Read-Host $Prompt).Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Prompt không được để trống."
    }

    return $value
}

# Gọi dotnet user-secrets set và kiểm tra mã thoát của từng khóa.
function Set-UserSecret {
    param(
        [string]$Key,
        [string]$Value,
        [string]$DotnetPath
    )

    # Chạy CLI cho đúng csproj; output chỉ được dùng khi báo lỗi.
    $secretOutput = & $DotnetPath user-secrets set `
        $Key `
        $Value `
        --project $backendProject 2>&1

    if ($LASTEXITCODE -ne 0) {
        $safeError = ($secretOutput | Out-String).Trim()
        if ([string]::IsNullOrWhiteSpace($safeError)) {
            $safeError = "Không lưu được cấu hình '$Key'."
        }

        throw $safeError
    }
}

try {
    if (-not (Test-Path -LiteralPath $backendProject)) {
        throw "Không tìm thấy backend PetNoVa tại $backendProject."
    }

    Write-Host '[PetNoVa] Cấu hình OTP Gmail và Firebase Admin' -ForegroundColor Cyan
    Write-Host 'Thông tin bí mật chỉ được lưu trong .NET User Secrets và LocalAppData.' -ForegroundColor DarkGray
    Write-Host ''

    # Sửa BOM cũ trước khi bất kỳ lệnh dotnet user-secrets nào parse JSON.
    Repair-UserSecretsEncoding -ProjectPath $backendProject

    # Hiện script cấu hình SMTP Gmail nên giới hạn đúng miền @gmail.com.
    $gmailAddress = Read-RequiredValue -Prompt 'Gmail dùng để gửi OTP'
    if ($gmailAddress -notmatch '^[^@\s]+@gmail\.com$') {
        throw 'Hãy nhập một địa chỉ @gmail.com hợp lệ.'
    }

    # Phải dùng Google App Password, không dùng mật khẩu đăng nhập Gmail thông thường.
    $secureAppPassword = Read-Host 'Google App Password (16 ký tự)' -AsSecureString
    if ($secureAppPassword.Length -eq 0) {
        throw 'Google App Password không được để trống.'
    }

    $serviceAccountSource = Read-RequiredValue -Prompt 'Đường dẫn file Firebase service-account JSON'
    $serviceAccountSource = [IO.Path]::GetFullPath($serviceAccountSource)
    if (-not (Test-Path -LiteralPath $serviceAccountSource -PathType Leaf)) {
        throw "Không tìm thấy file: $serviceAccountSource"
    }

    # Parse và kiểm tra loại/project/các field bắt buộc trước khi sao chép credential.
    $serviceAccount = Get-Content -LiteralPath $serviceAccountSource -Raw |
        ConvertFrom-Json

    if ($serviceAccount.type -ne 'service_account') {
        throw 'File JSON không phải Firebase service account.'
    }

    if ($serviceAccount.project_id -ne $expectedFirebaseProject) {
        throw "Service account thuộc project '$($serviceAccount.project_id)', không phải '$expectedFirebaseProject'."
    }

    if (
        [string]::IsNullOrWhiteSpace($serviceAccount.client_email) -or
        [string]::IsNullOrWhiteSpace($serviceAccount.private_key)
    ) {
        throw 'Service account JSON thiếu client_email hoặc private_key.'
    }

    # Đặt service account ngoài repository để Git không thể vô tình commit private key.
    $secretDirectory = Join-Path $env:LOCALAPPDATA 'PetNoVa\Secrets'
    New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
    $serviceAccountDestination = Join-Path $secretDirectory 'firebase-admin.json'
    Copy-Item `
        -LiteralPath $serviceAccountSource `
        -Destination $serviceAccountDestination `
        -Force

    $dotnetPath = (Get-Command dotnet -ErrorAction Stop).Source
    # Sinh pepper mật mã 48 byte dùng HMAC OTP/reset token, không tái dùng giá trị đoán được.
    $pepperBytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Fill($pepperBytes)
    $pepper = [Convert]::ToBase64String($pepperBytes)

    # Chỉ chuyển app password sang BSTR trong phạm vi cần truyền cho dotnet CLI.
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $secureAppPassword
    )

    try {
        $smtpPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            $secretPointer
        ) -replace '\s', ''

        if ($smtpPassword.Length -lt 16) {
            throw 'Google App Password phải có 16 ký tự (không tính khoảng trắng).'
        }

        # Gom toàn bộ SMTP, Firebase Admin và pepper để lưu nhất quán vào user-secrets.
        $settings = [ordered]@{
            'Email:SmtpHost' = 'smtp.gmail.com'
            'Email:SmtpPort' = '587'
            'Email:EnableSsl' = 'true'
            'Email:Username' = $gmailAddress
            'Email:Password' = $smtpPassword
            'Email:FromAddress' = $gmailAddress
            'Email:FromName' = 'PetNoVa'
            'FirebaseAdmin:ProjectId' = $expectedFirebaseProject
            'FirebaseAdmin:CredentialsPath' = $serviceAccountDestination
            'PasswordReset:Pepper' = $pepper
        }

        # Hàm chung kiểm tra mã thoát sau từng khóa, dừng ngay nếu một khóa không lưu được.
        foreach ($entry in $settings.GetEnumerator()) {
            Set-UserSecret `
                -Key $entry.Key `
                -Value $entry.Value `
                -DotnetPath $dotnetPath
        }
    }
    finally {
        # Xóa chuỗi/BSTR/mảng byte nhạy cảm khỏi bộ nhớ tốt nhất có thể.
        if ($secretPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
        }

        $smtpPassword = $null
        $pepper = $null
        [Array]::Clear($pepperBytes, 0, $pepperBytes.Length)
        $secureAppPassword.Dispose()
    }

    Write-Host ''
    Write-Host '✓ Đã cấu hình chức năng quên mật khẩu PetNoVa.' -ForegroundColor Green
    Write-Host '  Khởi động lại backend để áp dụng:' -ForegroundColor Green
    Write-Host '  .\run_petnova_dev.cmd -RestartBackend' -ForegroundColor Cyan
    Write-Host "  Service account an toàn tại: $serviceAccountDestination" -ForegroundColor DarkGray
}
catch {
    # Hiển thị hướng xử lý nhưng không lặp lại app password, private key hay pepper.
    Write-Host ''
    Write-Host 'KHÔNG THỂ CẤU HÌNH QUÊN MẬT KHẨU' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}
