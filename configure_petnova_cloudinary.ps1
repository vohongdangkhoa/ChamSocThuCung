# Script hỏi thông tin Cloudinary và lưu vào .NET user-secrets, không ghi secret vào Git.
[CmdletBinding()]
param()

# Dừng ngay khi lệnh/biến lỗi để không lưu bộ credential dở dang.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Xác định csproj tuyệt đối để dotnet user-secrets tìm đúng UserSecretsId.
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendProject = Join-Path $projectRoot 'backend\PetNoVaApi\PetNoVaApi.csproj'

# Đọc giá trị bắt buộc và hỏi lại nếu người dùng để trống.
function Read-RequiredValue {
    param([string]$Prompt)

    $value = (Read-Host $Prompt).Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Prompt không được để trống."
    }

    return $value
}

try {
    if (-not (Test-Path -LiteralPath $backendProject)) {
        throw "Không tìm thấy backend PetNoVa tại $backendProject."
    }

    Write-Host '[PetNoVa] Cấu hình Cloudinary cho backend' -ForegroundColor Cyan
    Write-Host 'Các giá trị này được lưu bằng .NET User Secrets và không nằm trong source code.' -ForegroundColor DarkGray
    Write-Host ''

    $cloudName = Read-RequiredValue -Prompt 'Cloud name'
    $apiKey = Read-RequiredValue -Prompt 'API key'
    # API secret được nhập ẩn; Cloud name và key không phải mật khẩu nhưng vẫn lưu cùng user-secrets.
    $secureApiSecret = Read-Host 'API secret' -AsSecureString

    if ($secureApiSecret.Length -eq 0) {
        throw 'API secret không được để trống.'
    }

    # dotnet CLI cần chuỗi thường nên chỉ giải mã SecureString trong phạm vi try/finally ngắn.
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $secureApiSecret
    )

    try {
        $apiSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            $secretPointer
        )

        # Hashtable có thứ tự giúp log/lỗi xuất hiện theo thứ tự CloudName -> Key -> Secret dễ theo dõi.
        $settings = [ordered]@{
            'Cloudinary:CloudName' = $cloudName
            'Cloudinary:ApiKey' = $apiKey
            'Cloudinary:ApiSecret' = $apiSecret
        }

        $dotnetPath = (Get-Command dotnet -ErrorAction Stop).Source

        # Lưu từng khóa vào kho bí mật gắn với csproj, tuyệt đối không sửa appsettings.json.
        foreach ($entry in $settings.GetEnumerator()) {
            $secretOutput = & $dotnetPath user-secrets set `
                $entry.Key `
                $entry.Value `
                --project $backendProject 2>&1

            # PowerShell không tự ném lỗi cho executable ngoài nên phải kiểm tra LASTEXITCODE.
            if ($LASTEXITCODE -ne 0) {
                $safeError = ($secretOutput | Out-String).Trim()
                if ([string]::IsNullOrWhiteSpace($safeError)) {
                    $safeError =
                        "Không lưu được cấu hình '$($entry.Key)'."
                }

                throw $safeError
            }
        }
    }
    finally {
        # Ghi đè bộ nhớ BSTR và dispose SecureString dù lưu thành công hay thất bại.
        if ($secretPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
        }

        $apiSecret = $null
        $secureApiSecret.Dispose()
    }

    Write-Host ''
    Write-Host '✓ Đã cấu hình Cloudinary cho PetNoVa.' -ForegroundColor Green
    Write-Host '  Khởi động lại backend bằng run_petnova_dev.cmd để áp dụng.' -ForegroundColor Green
}
catch {
    # Chỉ in thông báo lỗi; không in lại credential người dùng vừa nhập.
    Write-Host ''
    Write-Host 'KHÔNG THỂ CẤU HÌNH CLOUDINARY' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}
