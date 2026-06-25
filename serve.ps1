$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$port = 4173
$listener = [System.Net.Sockets.TcpListener]::Create($port)
$listener.Start()

function Get-ContentType([string]$path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.js' { 'application/javascript; charset=utf-8' }
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.svg' { 'image/svg+xml; charset=utf-8' }
    default { 'application/octet-stream' }
  }
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::ASCII, 1024, $true)
    $writer.NewLine = "`r`n"

    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { continue }

    $parts = $requestLine.Split(' ')
    $path = $parts[1]
    if ([string]::IsNullOrWhiteSpace($path) -or $path -eq '/') {
      $path = '/index.html'
    }

    $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/').Replace('/', '\')))
    if (-not $filePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $filePath -PathType Leaf)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
      $writer.WriteLine('HTTP/1.1 404 Not Found')
      $writer.WriteLine("Content-Type: text/plain; charset=utf-8")
      $writer.WriteLine("Content-Length: $($body.Length)")
      $writer.WriteLine('Connection: close')
      $writer.WriteLine()
      $writer.Flush()
      $stream.Write($body, 0, $body.Length)
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $writer.WriteLine('HTTP/1.1 200 OK')
    $writer.WriteLine("Content-Type: $(Get-ContentType $filePath)")
    $writer.WriteLine("Content-Length: $($bytes.Length)")
    $writer.WriteLine('Connection: close')
    $writer.WriteLine()
    $writer.Flush()
    $stream.Write($bytes, 0, $bytes.Length)
  } finally {
    $client.Close()
  }
}
