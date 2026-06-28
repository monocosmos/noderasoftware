Set-StrictMode -Version Latest

function New-NoderaSiteSection {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,

    [Parameter(Mandatory = $true)]
    [string] $DisplayName,

    [Parameter(Mandatory = $true)]
    [string[]] $CommitPaths,

    [bool] $RequiresApiBuild = $false,

    [bool] $RequiresWebBuild = $true
  )

  [pscustomobject]@{
    Name = $Name
    DisplayName = $DisplayName
    CommitPaths = $CommitPaths
    RequiresApiBuild = $RequiresApiBuild
    RequiresWebBuild = $RequiresWebBuild
  }
}

function Get-NoderaDeploySupportPaths {
  return @(
    "scripts/pi/deploy-from-github.sh",
    "scripts/workstation/build-windows-desktop-release.ps1",
    "scripts/workstation/deploy-pi-from-github.ps1",
    "scripts/workstation/publish-local-to-github.ps1",
    "scripts/workstation/site-sections.ps1"
  )
}

function Get-NoderaSiteSection {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("all", "home", "hotel", "videowallplayer")]
    [string] $Name
  )

  switch ($Name) {
    "all" {
      return New-NoderaSiteSection `
        -Name "all" `
        -DisplayName "Tum site ve uygulamalar" `
        -CommitPaths @(".") `
        -RequiresApiBuild $true `
        -RequiresWebBuild $true
    }
    "home" {
      return New-NoderaSiteSection `
        -Name "home" `
        -DisplayName "Ana sayfa" `
        -CommitPaths (@(
          "apps/web/src/app/page.tsx",
          "apps/web/src/sections/home",
          "apps/web/public/brand/nodera-logo.png",
          "apps/web/public/animations/hotelops-ad",
          "apps/web/public/web-build.json",
          "apps/web/out/index.html",
          "apps/web/out/index.txt",
          "apps/web/out/brand/nodera-logo.png",
          "apps/web/out/animations/hotelops-ad",
          "apps/web/out/_next/static",
          "apps/web/out/web-build.json"
        ) + (Get-NoderaDeploySupportPaths))
    }
    "hotel" {
      return New-NoderaSiteSection `
        -Name "hotel" `
        -DisplayName "HotelOps / HotelPanel" `
        -CommitPaths (@(
          "apps/api",
          "apps/desktop/package.json",
          "apps/desktop/src",
          "apps/desktop/build/icon.ico",
          "apps/desktop/build/icon.png",
          "apps/desktop/build/installer.nsh",
          "apps/web/src/app/classic.css",
          "apps/web/src/app/hotel",
          "apps/web/src/app/[...slug]/page.tsx",
          "apps/web/src/sections/hotel",
          "apps/web/src/components/hotel-ops",
          "apps/web/src/components/hotel-ops-app.tsx",
          "apps/web/src/components/hotel-ops-system.tsx",
          "apps/web/src/components/legacy-hotel-redirect.tsx",
          "apps/web/src/components/meter-tracking-page.tsx",
          "apps/web/src/lib/hotel-data.ts",
          "apps/web/src/lib/rbac.ts",
          "apps/web/src/lib/utils.ts",
          "apps/web/src/sections/hotel/routes.ts",
          "apps/web/public/app-version.json",
          "apps/web/public/maintenance-status.json",
          "apps/web/public/web-build.json",
          "apps/web/out/app-version.json",
          "apps/web/out/maintenance-status.json",
          "apps/web/out/web-build.json",
          "apps/web/out/hotel",
          "apps/web/out/hotelpanel",
          "apps/web/out/login",
          "apps/web/out/dashboard",
          "apps/web/out/jobs",
          "apps/web/out/maintenance",
          "apps/web/out/meter-tracking",
          "apps/web/out/housekeeping",
          "apps/web/out/calendar",
          "apps/web/out/reminders",
          "apps/web/out/notifications",
          "apps/web/out/shift-panels",
          "apps/web/out/modules",
          "apps/web/out/department",
          "apps/web/out/hotel-floor-planning",
          "apps/web/out/reports",
          "apps/web/out/users",
          "apps/web/out/app-settings",
          "apps/web/out/settings",
          "apps/web/out/_next/static",
          "package-lock.json",
          "prisma/schema.prisma",
          "runtime/maintenance-status.json"
        ) + (Get-NoderaDeploySupportPaths)) `
        -RequiresApiBuild $true
    }
    "videowallplayer" {
      return New-NoderaSiteSection `
        -Name "videowallplayer" `
        -DisplayName "VideoWallPlayer" `
        -CommitPaths (@(
          "apps/web/src/app/videowallplayer",
          "apps/web/src/sections/videowallplayer",
          "apps/web/public/brand/videowallplayer",
          "apps/web/public/web-build.json",
          "apps/web/out/videowallplayer",
          "apps/web/out/brand/videowallplayer",
          "apps/web/out/_next/static",
          "apps/web/out/web-build.json"
        ) + (Get-NoderaDeploySupportPaths))
    }
  }
}
