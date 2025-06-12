# Multi-platform Docker build script for PowerShell
# This script builds Docker images for both AMD64 and ARM64 architectures

param(
  [Parameter(Mandatory = $false)]
  [string]$ImageName = "heimdall",
    
  [Parameter(Mandatory = $false)]
  [string]$Tag = "latest",
    
  [Parameter(Mandatory = $false)]
  [switch]$Push = $false,
    
  [Parameter(Mandatory = $false)]
  [switch]$UseOptimized = $false
)

# Set the dockerfile to use
$dockerfile = if ($UseOptimized) { "Dockerfile.optimized" } else { "Dockerfile" }

Write-Host "Building multi-platform Docker image..." -ForegroundColor Green
Write-Host "Image: $ImageName" -ForegroundColor Yellow
Write-Host "Tag: $Tag" -ForegroundColor Yellow
Write-Host "Dockerfile: $dockerfile" -ForegroundColor Yellow
Write-Host "Push to registry: $Push" -ForegroundColor Yellow

# Create buildx builder if it doesn't exist
Write-Host "`nSetting up Docker buildx..." -ForegroundColor Green
docker buildx create --name multiplatform --use --bootstrap 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Builder already exists or failed to create, using existing..." -ForegroundColor Yellow
  docker buildx use multiplatform 2>$null
}

# Build command
$buildArgs = @(
  "buildx", "build"
  "--platform", "linux/amd64,linux/arm64"
  "--file", $dockerfile
  "--tag", "${ImageName}:${Tag}"
)

if ($Push) {
  $buildArgs += "--push"
}
else {
  $buildArgs += "--load"
  Write-Host "`nNote: Multi-platform images cannot be loaded locally without --push." -ForegroundColor Yellow
  Write-Host "Building for local use will only build for your current platform." -ForegroundColor Yellow
  # For local builds, only build for current platform
  $buildArgs = $buildArgs | Where-Object { $_ -ne "--platform" -and $_ -ne "linux/amd64,linux/arm64" }
}

$buildArgs += "."

Write-Host "`nExecuting: docker $($buildArgs -join ' ')" -ForegroundColor Cyan
& docker @buildArgs

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nBuild completed successfully!" -ForegroundColor Green
  if ($Push) {
    Write-Host "Images pushed to registry for both AMD64 and ARM64 platforms." -ForegroundColor Green
  }
  else {
    Write-Host "Image built locally for current platform." -ForegroundColor Green
  }
}
else {
  Write-Host "`nBuild failed!" -ForegroundColor Red
  exit 1
}
