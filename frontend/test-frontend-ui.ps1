#!/usr/bin/env pwsh
# Frontend UI Testing Script for Password Reset

Write-Host "🧪 Testing Frontend UI Components..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Test 1: Check if frontend is running
Write-Host "`n📋 Test 1: Frontend Server Status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Frontend server is running (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend server is not running" -ForegroundColor Red
    exit 1
}

# Test 2: Check login page structure
Write-Host "`n📋 Test 2: Login Page Content" -ForegroundColor Yellow
try {
    $loginPage = Invoke-WebRequest -Uri "http://localhost:5173/login" -UseBasicParsing -TimeoutSec 5
    
    if ($loginPage.Content -match "Forgot password") {
        Write-Host "✅ Login page contains 'Forgot password' link" -ForegroundColor Green
    } else {
        Write-Host "❌ Login page missing 'Forgot password' link" -ForegroundColor Red
    }
    
    if ($loginPage.Content -match "Sign in") {
        Write-Host "✅ Login page contains sign in form" -ForegroundColor Green
    } else {
        Write-Host "❌ Login page missing sign in form" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Could not access login page: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check forgot password page
Write-Host "`n📋 Test 3: Forgot Password Page" -ForegroundColor Yellow
try {
    $forgotPage = Invoke-WebRequest -Uri "http://localhost:5173/forgot-password" -UseBasicParsing -TimeoutSec 5
    
    if ($forgotPage.Content -match "Forgot password") {
        Write-Host "✅ Forgot password page loads successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Forgot password page content issue" -ForegroundColor Red
    }
    
    if ($forgotPage.Content -match "Email") {
        Write-Host "✅ Forgot password page contains email field" -ForegroundColor Green
    } else {
        Write-Host "❌ Forgot password page missing email field" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Could not access forgot password page: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Check reset password page structure
Write-Host "`n📋 Test 4: Reset Password Page" -ForegroundColor Yellow
try {
    $resetPage = Invoke-WebRequest -Uri "http://localhost:5173/reset-password?token=test123" -UseBasicParsing -TimeoutSec 5
    
    if ($resetPage.Content -match "Set new password") {
        Write-Host "✅ Reset password page loads successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Reset password page content issue" -ForegroundColor Red
    }
    
    if ($resetPage.Content -match "password") {
        Write-Host "✅ Reset password page contains password fields" -ForegroundColor Green
    } else {
        Write-Host "❌ Reset password page missing password fields" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Could not access reset password page: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Backend API connectivity from frontend perspective
Write-Host "`n📋 Test 5: Backend API Connectivity" -ForegroundColor Yellow
try {
    # Test health endpoint
    $health = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -eq 200) {
        Write-Host "✅ Backend API is accessible (Status: $($health.StatusCode))" -ForegroundColor Green
    }
    
    # Test CORS headers
    if ($health.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "✅ CORS headers are present" -ForegroundColor Green
    } else {
        Write-Host "⚠️  CORS headers might be missing" -ForegroundColor Yellow
    }
    
    if ($health.Headers["Access-Control-Allow-Credentials"]) {
        Write-Host "✅ CORS credentials enabled" -ForegroundColor Green
    } else {
        Write-Host "⚠️  CORS credentials might not be enabled" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Backend API is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Test forgot password API endpoint
Write-Host "`n📋 Test 6: Password Reset API Functionality" -ForegroundColor Yellow
try {
    $testEmail = @{ email = "test@example.com" } | ConvertTo-Json
    $apiResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/forgot-password" -Method POST -Body $testEmail -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
    
    if ($apiResponse.StatusCode -eq 200) {
        Write-Host "✅ Forgot password API responds correctly (Status: $($apiResponse.StatusCode))" -ForegroundColor Green
        
        $responseData = $apiResponse.Content | ConvertFrom-Json
        if ($responseData.ok -eq $true) {
            Write-Host "✅ API returns success response" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ Forgot password API test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Frontend UI Test Summary" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "✅ Tests completed - Check results above" -ForegroundColor Green
Write-Host "`n📖 Manual Testing Guide:" -ForegroundColor Yellow
Write-Host "1. Visit: http://localhost:5173/login" -ForegroundColor White
Write-Host "2. Click 'Forgot password?' link" -ForegroundColor White
Write-Host "3. Enter: test@example.com" -ForegroundColor White
Write-Host "4. Submit and check for success message" -ForegroundColor White
Write-Host "5. Check Ethereal Email: https://ethereal.email/login" -ForegroundColor White
Write-Host "   Username: bqknqkslyutekcgr@ethereal.email" -ForegroundColor White
Write-Host "   Password: DpGhpKN9hwKsEGNQrE" -ForegroundColor White
