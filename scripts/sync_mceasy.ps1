<#
.SYNOPSIS
    Script Sinkronisasi Otomatis GPS Tracker McEasy ke Supabase Database
    PT SURYA SARANA INVESTASI (Digi-Action & DigiCore)
#>

param (
    [string]$MceasyToken = "yFMAbYZEceX4fmJ4dUfRBbim9y2fYZm7FuHaWdZ4ObKSbQHBb0ye8ddveOUSNJ2JrbDc8KFw7pVpkace2vaaana5fI9PLFdfadqZ2oweSaf5f5g43WdBtjce8CZb9n4fjwfVTeoawf1XwAaSHhUfV9V49bcedJ2UbZM1QgaHp9caCaa3bbe9H99Pp97afS1aSK52f4it5JTEe9kiMp3drlzjtOAfm9wUd3dFR0GgbJD9sbGhjvwb9a9V9q2dRb9u",
    [string]$SupabaseUrl = "https://pqfzkizqqhmsnidocumv.supabase.co",
    [string]$SupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZnpraXpxcWhtc25pZG9jdW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc2MTUsImV4cCI6MjEwNDQ1MzYxNX0.06q1t6BEk01wwQOO68hH_HtcsIdfUgbtBbcOhoXukKo",
    [bool]$RecordHistory = $true
)

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [McEasy -> Supabase Sync Engine] Memulai Penarikan Data" -ForegroundColor Cyan
Write-Host " Waktu: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan

# 1. TARIK DATA DARI MCEASY API
$mceasyHeaders = @{
    "Authorization" = "Bearer $MceasyToken"
    "Accept"        = "application/json"
}

$mceasyUrl = "https://vsms-v2-public.mceasy.com/v1/vehicles/statuses"

try {
    Write-Host "[1/3] Menghubungi McEasy API ($mceasyUrl)..." -NoNewline
    $response = Invoke-RestMethod -Uri $mceasyUrl -Headers $mceasyHeaders -Method Get
    $vehicles = $response.data
    Write-Host " BERHASIL!" -ForegroundColor Green
    Write-Host "      Ditemukan $($vehicles.Count) unit kendaraan." -ForegroundColor Yellow
} catch {
    Write-Host " GAGAL!" -ForegroundColor Red
    Write-Error "Error memanggil McEasy API: $($_.Exception.Message)"
    exit 1
}

# 2. TRANSFORMASI PAYLOAD KE FORMAT SUPABASE
Write-Host "[2/3] Mentransformasi data ke format tabel Supabase..."
$trackingPayload = @()
$historyPayload = @()
$nowUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

foreach ($item in $vehicles) {
    # Ambil nama grup kendaraan pertama jika ada
    $groupName = $null
    if ($item.vehicleGroups -and $item.vehicleGroups.Count -gt 0) {
        $groupName = $item.vehicleGroups[0]
    }

    # Waktu GPS terakhir
    $gpsTime = $item.lastPacket
    if (-not $gpsTime) { $gpsTime = $item.lastMotion }
    if (-not $gpsTime) { $gpsTime = $nowUtc }

    $lat = [double]$item.latitude
    $lng = [double]$item.longitude

    $record = @{
        "vehicle_id"         = "$($item.vehicleId)"
        "plate_number"       = "$($item.licensePlate)"
        "vehicle_name"       = "$($item.device.deviceName)"
        "imei"               = "$($item.imei)"
        "vehicle_group_name" = $groupName
        "company_name"       = "$($item.companyName)"
        "latitude"           = $lat
        "longitude"          = $lng
        "speed"              = [double]$item.speed
        "direction"          = [int]$item.direction
        "engine_on"          = [bool]$item.engineOn
        "motion_status"      = "$($item.motionStatus)"
        "battery"            = [int]$item.battery
        "signal_strength"    = [int]$item.signalStrength
        "trip_distance"      = [double]$item.tripDistance
        "total_distance"     = [double]$item.sumDistance
        "address"            = if ($item.address) { "$($item.address)" } else { $null }
        "gps_updated_at"     = $gpsTime
        "synced_at"          = $nowUtc
    }
    $trackingPayload += $record

    # Catat ke history jika koordinat valid
    if ($RecordHistory -and $lat -ne 0 -and $lng -ne 0) {
        $histRecord = @{
            "vehicle_id"    = "$($item.vehicleId)"
            "plate_number"  = "$($item.licensePlate)"
            "latitude"      = $lat
            "longitude"     = $lng
            "speed"         = [double]$item.speed
            "direction"     = [int]$item.direction
            "engine_on"     = [bool]$item.engineOn
            "motion_status" = "$($item.motionStatus)"
            "battery"       = [int]$item.battery
            "trip_distance" = [double]$item.tripDistance
            "gps_timestamp" = $gpsTime
            "created_at"    = $nowUtc
        }
        $historyPayload += $histRecord
    }
}

# 3. UPSERT KE SUPABASE (vehicles_tracking)
Write-Host "[3/3] Mengirimkan data ke Supabase..."
$supabaseHeaders = @{
    "apikey"        = $SupabaseAnonKey
    "Authorization" = "Bearer $SupabaseAnonKey"
    "Content-Type"  = "application/json"
    "Prefer"        = "resolution=merge-duplicates"
}

# A. Upsert Live Tracking
$supabaseEndpoint = "$SupabaseUrl/rest/v1/vehicles_tracking"
$jsonBody = $trackingPayload | ConvertTo-Json -Depth 5

try {
    $null = Invoke-RestMethod -Uri $supabaseEndpoint -Headers $supabaseHeaders -Method Post -Body $jsonBody
    Write-Host " [Live Tracking] $($trackingPayload.Count) armada berhasil di-upsert ke 'vehicles_tracking'." -ForegroundColor Green
} catch {
    Write-Host " [Live Tracking] GAGAL UPSERT: $($_.Exception.Message)" -ForegroundColor Red
}

# B. Insert History Tracking (jika diaktifkan)
if ($RecordHistory -and $historyPayload.Count -gt 0) {
    $histEndpoint = "$SupabaseUrl/rest/v1/vehicles_tracking_history"
    $histHeaders = @{
        "apikey"        = $SupabaseAnonKey
        "Authorization" = "Bearer $SupabaseAnonKey"
        "Content-Type"  = "application/json"
    }
    $histJson = $historyPayload | ConvertTo-Json -Depth 5
    try {
        $null = Invoke-RestMethod -Uri $histEndpoint -Headers $histHeaders -Method Post -Body $histJson
        Write-Host " [History Log]   $($historyPayload.Count) log jejak berhasil dicatat ke 'vehicles_tracking_history'." -ForegroundColor Green
    } catch {
        Write-Host " [History Log]   Gagal simpan log history: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " PROSES SINKRONISASI SELESAI!" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
