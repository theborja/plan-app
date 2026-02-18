param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$Email = "",
  [string]$Password = "",
  [string]$DateISO = "2026-02-18"
)

$ErrorActionPreference = "Stop"

function Step([string]$message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function AssertStatus([int]$Status, [string]$Label) {
  if ($Status -lt 200 -or $Status -ge 300) {
    throw "$Label failed with HTTP $Status"
  }
  Write-Host "OK $Label ($Status)" -ForegroundColor Green
}

$base = $BaseUrl.TrimEnd("/")
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Step "Health pages"
$home = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -WebSession $session
AssertStatus $home.StatusCode "GET /"
$loginPage = Invoke-WebRequest -Uri "$base/login" -UseBasicParsing -WebSession $session
AssertStatus $loginPage.StatusCode "GET /login"

if ($Email -and $Password) {
  Step "Auth login"
  $body = @{ email = $Email; password = $Password } | ConvertTo-Json
  $login = Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body $body -UseBasicParsing -WebSession $session
  AssertStatus $login.StatusCode "POST /api/auth/login"

  $me = Invoke-WebRequest -Uri "$base/api/auth/me" -Method Get -UseBasicParsing -WebSession $session
  AssertStatus $me.StatusCode "GET /api/auth/me"
} else {
  Write-Host "Skipping auth checks (no Email/Password provided)." -ForegroundColor Yellow
}

Step "Core data endpoints"
$urls = @(
  "$base/api/plans/active",
  "$base/api/workout/day?date=$DateISO",
  "$base/api/progress/blocks",
  "$base/api/measures/week"
)

foreach ($url in $urls) {
  $resp = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing -WebSession $session
  AssertStatus $resp.StatusCode "GET $url"
}

Step "Smoke tests finished"
Write-Host "Smoke test completed." -ForegroundColor Green
