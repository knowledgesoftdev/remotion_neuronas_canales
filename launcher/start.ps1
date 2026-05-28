$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Si ya corre, abre el browser y sal
$running = Get-NetTCPConnection -LocalPort 5172 -State Listen -ErrorAction SilentlyContinue
if ($running) {
    Start-Process "http://localhost:5172/"
    exit
}

# Arranca npm run dev en ventana minimizada
Start-Process -FilePath "cmd.exe" -ArgumentList "/k npm run dev" -WorkingDirectory $dir -WindowStyle Minimized

# Espera que Vite levante
Start-Sleep -Seconds 5

# Abre el browser
Start-Process "http://localhost:5172/"
