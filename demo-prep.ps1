# CLIENT DEMO PREPARATION
Write-Host "PREPARING CLIENT DEMO" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Gray

# Check if servers are running
Write-Host ""
Write-Host "1. Checking if servers are running..." -ForegroundColor Yellow
$frontend = $null
$backend = $null

try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -UseBasicParsing
    Write-Host "   OK Frontend server (http://localhost:5173)" -ForegroundColor Green
} catch {
    Write-Host "   ERROR Frontend server not running" -ForegroundColor Red
    Write-Host "         Run: npm run dev:both" -ForegroundColor Yellow
}

try {
    $backend = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -TimeoutSec 3 -UseBasicParsing
    Write-Host "   OK Backend server (http://localhost:5000)" -ForegroundColor Green
} catch {
    Write-Host "   ERROR Backend server not running" -ForegroundColor Red
    Write-Host "         Run: npm run dev:both" -ForegroundColor Yellow
}

# Check demo users exist
Write-Host ""
Write-Host "2. Verifying demo users..." -ForegroundColor Yellow
$username = Read-Host "Enter MySQL username (default: root)"
if ([string]::IsNullOrWhiteSpace($username)) {
    $username = "root"
}

$securePassword = Read-Host "Enter MySQL password" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

$checkUsers = @"
USE Rawson; 
SELECT 
  CONCAT('   ', Role, ': ', Email, ' (', Status, ')') as UserInfo
FROM tblusers 
WHERE Email IN ('staff@demo.com', 'client@demo.com', 'landlord@demo.com', 'contractor@demo.com')
ORDER BY Role;
"@

$userCheck = cmd /c "mysql -u $username -p$password -e `"$checkUsers`"" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host $userCheck -ForegroundColor White
} else {
    Write-Host "   ERROR Could not verify demo users" -ForegroundColor Red
}

# Demo checklist
Write-Host ""
Write-Host "PRE-RECORDING CHECKLIST:" -ForegroundColor Cyan
Write-Host "   [ ] Close unnecessary applications" -ForegroundColor White
Write-Host "   [ ] Clear browser cache/cookies" -ForegroundColor White
Write-Host "   [ ] Prepare test image file for upload" -ForegroundColor White
Write-Host "   [ ] Have demo script open: CLIENT_DEMO_SCRIPT.md" -ForegroundColor White
Write-Host "   [ ] Set screen recording to 1080p" -ForegroundColor White

Write-Host ""
Write-Host "DEMO URLS:" -ForegroundColor Green  
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend Health: http://localhost:5000/api/health" -ForegroundColor White

Write-Host ""
Write-Host "TEST ACCOUNTS:" -ForegroundColor Green
Write-Host "   Staff:      staff@demo.com / Password123!" -ForegroundColor White
Write-Host "   Client:     client@demo.com / Password123!" -ForegroundColor White  
Write-Host "   Landlord:   landlord@demo.com / Password123!" -ForegroundColor White
Write-Host "   Contractor: contractor@demo.com / Password123!" -ForegroundColor White

Write-Host ""
Write-Host "Ready to record! Follow CLIENT_DEMO_SCRIPT.md" -ForegroundColor Green