# Robust Multiplatform PowerShell Web Server (Menggunakan HttpListener)
$port = 8080
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".pdf"  = "application/pdf"
    ".txt"  = "text/plain; charset=utf-8"
}

$prefix = "http://localhost:$port/"
$prefixIp = "http://127.0.0.1:$port/"

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Prefixes.Add($prefixIp)

try {
    $listener.Start()
} catch {
    Write-Host "[ERROR] Gagal menjalankan HttpListener di port $($port): $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Mencoba alternatif TcpListener..." -ForegroundColor Yellow
    
    # Fallback ke TcpListener jika HttpListener terblokir permission
    $tcp = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    $tcp.Start()
    
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Digi-Action Local Dev Server Berjalan (TCP mode)!" -ForegroundColor Green
    Write-Host " Akses di Browser: http://localhost:$port/" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
    
    while ($true) {
        try {
            $client = $tcp.AcceptTcpClient()
            [System.Threading.ThreadPool]::QueueUserWorkItem({
                param($c, $rDir, $mTypes)
                try {
                    $stream = $c.GetStream()
                    $reader = [System.IO.StreamReader]::new($stream)
                    $req = $reader.ReadLine()
                    if (-not $req) { $c.Close(); return }
                    
                    while ($true) {
                        $l = $reader.ReadLine()
                        if ([string]::IsNullOrEmpty($l)) { break }
                    }
                    
                    $parts = $req.Split(" ")
                    $rawUrl = $parts[1].Split("?")[0].TrimStart('/')
                    if (-not $rawUrl) { $rawUrl = "index.html" }
                    
                    $f = [System.IO.Path]::GetFullPath((Join-Path $rDir $rawUrl))
                    if (-not (Test-Path $f -PathType Leaf)) {
                        $f = Join-Path $rDir "index.html"
                    }
                    
                    if (Test-Path $f -PathType Leaf) {
                        $ext = [System.IO.Path]::GetExtension($f).ToLower()
                        $ct = $mTypes[$ext]
                        if (-not $ct) { $ct = "application/octet-stream" }
                        $bytes = [System.IO.File]::ReadAllBytes($f)
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                        $hBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($hBytes, 0, $hBytes.Length)
                        $stream.Write($bytes, 0, $bytes.Length)
                        $stream.Flush()
                    }
                } catch {}
                finally {
                    try { $c.Close() } catch {}
                }
            }, @($client, $root, $mimeTypes)) | Out-Null
        } catch {
            Start-Sleep -Milliseconds 100
        }
    }
    exit 0
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Digi-Action Local Dev Server Berjalan!" -ForegroundColor Green
Write-Host " Akses di Browser: http://localhost:$port/" -ForegroundColor Yellow
Write-Host " Root Directory  : $root" -ForegroundColor DarkGray
Write-Host " Tekan Ctrl+C untuk menghentikan server." -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        [System.Threading.ThreadPool]::QueueUserWorkItem({
            param($ctx, $rDir, $mTypes)
            try {
                $req = $ctx.Request
                $res = $ctx.Response

                $rawUrl = $req.Url.LocalPath.TrimStart('/')
                if ([string]::IsNullOrWhiteSpace($rawUrl)) {
                    $rawUrl = "index.html"
                }

                $filePath = [System.IO.Path]::GetFullPath((Join-Path $rDir $rawUrl))

                # SPA Fallback
                if (-not (Test-Path $filePath -PathType Leaf)) {
                    if (-not [System.IO.Path]::HasExtension($rawUrl)) {
                        $filePath = Join-Path $rDir "index.html"
                    }
                }

                if (Test-Path $filePath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = $mTypes[$ext]
                    if (-not $contentType) { $contentType = "application/octet-stream" }

                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $res.ContentType = $contentType
                    $res.ContentLength64 = $bytes.Length
                    $res.AddHeader("Access-Control-Allow-Origin", "*")
                    $res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
                    $res.OutputStream.Write($bytes, 0, $bytes.Length)
                    $res.StatusCode = 200
                    Write-Host "[200 OK] $($req.HttpMethod) $($req.Url.PathAndQuery)" -ForegroundColor Green
                } else {
                    $res.StatusCode = 404
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $res.ContentLength64 = $msg.Length
                    $res.OutputStream.Write($msg, 0, $msg.Length)
                    Write-Host "[404 Not Found] $($req.HttpMethod) $($req.Url.PathAndQuery)" -ForegroundColor Yellow
                }
            } catch {
                # Mengabaikan error koneksi yang diputus browser saat reload
            } finally {
                try {
                    $ctx.Response.OutputStream.Close()
                    $ctx.Response.Close()
                } catch {}
            }
        }, @($context, $root, $mimeTypes)) | Out-Null
    } catch {
        # Mengabaikan error listener terputus
    }
}
