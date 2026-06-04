param(
  [string]$RepoName = "grassroots-cocktail-recommender",
  [string]$Visibility = "private"
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $ProjectRoot

if ($Visibility -notin @("private", "public")) {
  throw "Visibility must be either 'private' or 'public'."
}

Write-Host "Publishing Grassroots Cocktail Recommender from:"
Write-Host "  $ProjectRoot"
Write-Host ""

git --version | Out-Host
gh --version | Select-Object -First 1 | Out-Host
gh auth status | Out-Host

$SafePath = $ProjectRoot.Path -replace "\\", "/"
git config --global --add safe.directory $SafePath

if (-not (Test-Path -LiteralPath ".git")) {
  git init -b main
}

git branch -M main
git config user.name "tonygudkov"
git config user.email "tonygudkov@users.noreply.github.com"

git add .

$Status = git status --porcelain
if ($Status) {
  git commit -m "Initial Grassroots Vercel app"
}
else {
  Write-Host "No local changes to commit."
}

$Owner = gh api user --jq ".login"
$Owner = $Owner.Trim()
$FullRepo = "$Owner/$RepoName"

cmd.exe /d /c "gh repo view $FullRepo --json url >NUL 2>NUL"
$RepoExists = ($LASTEXITCODE -eq 0)

if (-not $RepoExists) {
  if ($Visibility -eq "public") {
    gh repo create $RepoName --public --source . --remote origin
  }
  else {
    gh repo create $RepoName --private --source . --remote origin
  }
}
else {
  $RemoteUrl = "https://github.com/$FullRepo.git"
  $Origin = $null
  cmd.exe /d /c "git remote get-url origin >NUL 2>NUL"
  if ($LASTEXITCODE -eq 0) {
    $Origin = git remote get-url origin
  }
  if (-not $Origin) {
    git remote add origin $RemoteUrl
  }
  elseif ($Origin -ne $RemoteUrl) {
    git remote set-url origin $RemoteUrl
  }
}

git push -u origin main

Write-Host ""
Write-Host "Published successfully:"
Write-Host "  https://github.com/$FullRepo"
