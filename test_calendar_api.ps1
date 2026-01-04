# カレンダーAPIテスト用PowerShellスクリプト

# 設定
$baseUrl = "https://rwjhpfghhgstvplmggks.functions.supabase.co/calendar-events"
$testUserId = "123e4567-e89b-12d3-a456-426614174000"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo"

# JWT取得（実際のアプリではsupabase.auth.getSession()を使用）
# ここではテスト用にモックJWTを作成
$mockJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwic3ViIjoiMTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjE0MTc0MDAwIiwiaWF0IjoxNzU4NzA4MzQ2LCJleHAiOjIwNzQyODQzNDZ9.test"

Write-Host "=== カレンダーAPIテスト ===" -ForegroundColor Green

# 1. 認証なし（401期待）
Write-Host "`n1. 認証なしテスト" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl?user_id=$testUserId" -Method GET -UseBasicParsing -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if($response.StatusCode -eq 401) {"Green"} else {"Red"})
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. 認証あり（200期待）
Write-Host "`n2. 認証ありテスト" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $mockJwt"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "$baseUrl?user_id=$testUserId" -Method GET -Headers $headers -UseBasicParsing -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if($response.StatusCode -eq 200) {"Green"} else {"Red"})
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. POSTテスト
Write-Host "`n3. POSTテスト" -ForegroundColor Yellow
$postBody = @{
    user_id = $testUserId
    title = "テスト予定"
    start_at = "2026-01-05T10:00:00Z"
    end_at = "2026-01-05T11:00:00Z"
}
$jsonBody = $postBody | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Headers $headers -Body $jsonBody -UseBasicParsing -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if($response.StatusCode -eq 200) {"Green"} else {"Red"})
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== テスト完了 ===" -ForegroundColor Green
