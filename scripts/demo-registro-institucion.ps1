# Demo aislada de ME-REG2B1. No toca masterexpress_control_dev ni el QA compartido.
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $raiz 'apps\api'
$mysql = 'C:\Program Files\MySQL\MySQL Server 9.1\bin'
$mysqld = Join-Path $mysql 'mysqld.exe'
$mysqlcli = Join-Path $mysql 'mysql.exe'
$mysqladmin = Join-Path $mysql 'mysqladmin.exe'
$demo = Join-Path $env:TEMP 'me-demo-registro-institucion'
$datadir = Join-Path $demo 'datadir'
$claveArchivo = Join-Path $demo 'clave.txt'
$llaveArchivo = Join-Path $demo 'app.key'
$puertoMysql = 3317
$procesos = @()

function Puerto-Abierto([int] $Puerto) {
    $cliente = New-Object System.Net.Sockets.TcpClient
    try {
        $cliente.Connect('127.0.0.1', $Puerto)
        return $true
    } catch {
        return $false
    } finally {
        $cliente.Dispose()
    }
}

function Assert-PuertoLibre([int] $Puerto, [string] $Nombre) {
    if (Puerto-Abierto $Puerto) {
        throw "$Nombre necesita el puerto $Puerto y ya está ocupado. Cierra ese programa antes de volver a iniciar."
    }
}

function Esperar-Http([string] $Url, [scriptblock] $Listo) {
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $respuesta = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if (& $Listo $respuesta) { return $respuesta }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    throw "No respondió $Url."
}

function Detener-Demo {
    foreach ($proceso in $procesos) {
        if ($proceso -and -not $proceso.HasExited) {
            Stop-Process -Id $proceso.Id -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path $claveArchivo) {
        $clave = (Get-Content $claveArchivo -Raw).Trim()
        $anterior = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $mysqladmin --protocol=TCP -h 127.0.0.1 -P $puertoMysql -u root "-p$clave" shutdown 2>$null
        $ErrorActionPreference = $anterior
    }
}

if ($args -contains '-Aprobar') {
    if (-not (Test-Path $claveArchivo) -or -not (Test-Path $llaveArchivo)) {
        throw 'La demo no está preparada. Inicia primero scripts\demo-registro-institucion.ps1.'
    }
    $env:APP_ENV = 'testing'
    $env:APP_KEY = (Get-Content $llaveArchivo -Raw).Trim()
    $env:DB_CONNECTION = 'mysql_pruebas'
    $env:ME_MYSQL_TEST_PORT = "$puertoMysql"
    $env:ME_MYSQL_TEST_USERNAME = 'root'
    $env:ME_MYSQL_TEST_PASSWORD = (Get-Content $claveArchivo -Raw).Trim()
    $env:QUEUE_CONNECTION = 'database'
    $php = @'
<?php
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$solicitud = App\Models\SolicitudInstitucional::query()->where("estado", "pendiente")->orderByDesc("id")->first();
if (!$solicitud) { fwrite(STDERR, "No hay solicitudes pendientes.\n"); exit(1); }
$admin = App\Models\User::query()->where("email", "admin.demo@example.invalid")->firstOrFail();
app(App\Actions\DecidirSolicitudInstitucional::class)->aprobar($admin, (int) $solicitud->id);
echo "APROBADA ".$solicitud->id.PHP_EOL;
'@
    $script = Join-Path $env:TEMP 'me-demo-aprobar.php'
    Set-Content -Path $script -Value $php -Encoding utf8
    Push-Location $api
    try { & php $script } finally { Pop-Location; Remove-Item $script -ErrorAction SilentlyContinue }
    Write-Output 'Revisa el enlace en http://127.0.0.1:8026/ y ábrelo en Chrome.'
    exit $LASTEXITCODE
}

Assert-PuertoLibre 8000 'Laravel'
Assert-PuertoLibre 5173 'Vite'
Assert-PuertoLibre 2526 'Correo local'
Assert-PuertoLibre 8026 'Bandeja local'
Assert-PuertoLibre $puertoMysql 'MySQL de demostración'

New-Item -ItemType Directory -Path $datadir -Force | Out-Null
if (-not (Test-Path (Join-Path $datadir 'mysql'))) {
    & $mysqld --initialize-insecure --datadir="$datadir"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar MySQL temporal.' }
}
$mysqldProc = Start-Process -FilePath $mysqld -ArgumentList "--datadir=$datadir", "--port=$puertoMysql", '--bind-address=127.0.0.1', '--mysqlx=0' -WindowStyle Hidden -PassThru
$procesos += $mysqldProc
$lista = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Puerto-Abierto $puertoMysql) { $lista = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $lista) { Detener-Demo; throw 'MySQL temporal no abrió el puerto 3317.' }

if (-not (Test-Path $claveArchivo)) {
    $clave = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    & $mysqlcli --protocol=TCP -h 127.0.0.1 -P $puertoMysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$clave'; CREATE DATABASE masterexpress_control_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) { Detener-Demo; throw 'No se pudo crear el esquema temporal.' }
    Set-Content -Path $claveArchivo -Value $clave -Encoding ascii
}
$clave = (Get-Content $claveArchivo -Raw).Trim()
$identidad = & $mysqlcli --protocol=TCP -h 127.0.0.1 -P $puertoMysql -u root "-p$clave" -N -e "SELECT @@port, DATABASE();" masterexpress_control_test
if ($identidad -notmatch "^$puertoMysql\s+masterexpress_control_test") {
    Detener-Demo
    throw 'La conexión no apunta al esquema temporal. No se migró ninguna base persistente.'
}

if (-not (Test-Path $llaveArchivo)) {
    $llave = & php -r "echo 'base64:'.base64_encode(random_bytes(32));"
    Set-Content -Path $llaveArchivo -Value $llave.Trim() -Encoding ascii
}

$env:APP_ENV = 'testing'
$env:APP_KEY = (Get-Content $llaveArchivo -Raw).Trim()
$env:DB_CONNECTION = 'mysql_pruebas'
$env:ME_MYSQL_TEST_PORT = "$puertoMysql"
$env:ME_MYSQL_TEST_USERNAME = 'root'
$env:ME_MYSQL_TEST_PASSWORD = $clave
$env:SESSION_DRIVER = 'database'
$env:SESSION_CONNECTION = 'mysql_pruebas'
$env:SESSION_SECURE_COOKIE = 'false'
$env:QUEUE_CONNECTION = 'database'
$env:MAIL_MAILER = 'smtp'
$env:MAIL_URL = 'smtp://127.0.0.1:2526'
$env:SANCTUM_STATEFUL_DOMAINS = '127.0.0.1:5173,127.0.0.1:8000'
$env:SPA_ALLOWED_ORIGINS = 'http://127.0.0.1:5173'

Push-Location $api
try {
    & php artisan migrate --database=mysql_pruebas --env=testing --seed --force --no-interaction
    if ($LASTEXITCODE -ne 0) { throw 'La migración temporal falló.' }
    $php = @'
<?php
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$rol = App\Models\Rol::query()->where("codigo", "administrador")->firstOrFail();
$admin = App\Models\User::query()->firstOrCreate(["email" => "admin.demo@example.invalid"], ["name" => "Admin demo", "password" => "Clave ficticia de QA"]);
$admin->forceFill(["email_verified_at" => now(), "activa" => true, "password" => "Clave ficticia de QA"])->save();
$admin->roles()->syncWithoutDetaching([$rol->id]);
echo "ADMIN_LISTO\n";
'@
    $script = Join-Path $env:TEMP 'me-demo-admin.php'
    Set-Content -Path $script -Value $php -Encoding utf8
    & php $script
    Remove-Item $script -ErrorAction SilentlyContinue
} finally { Pop-Location }

$procesos += Start-Process -FilePath 'node' -ArgumentList 'tests\correo-registro-local.mjs' -WorkingDirectory $raiz -WindowStyle Hidden -PassThru
$procesos += Start-Process -FilePath 'php' -ArgumentList 'artisan','queue:work','database','--queue=registro-institucion,registro-graduando,recuperacion','--sleep=1','--tries=1' -WorkingDirectory $api -WindowStyle Hidden -PassThru
$procesos += Start-Process -FilePath 'php' -ArgumentList 'artisan','serve','--host=127.0.0.1','--port=8000' -WorkingDirectory $api -WindowStyle Hidden -PassThru
$procesos += Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory $raiz -WindowStyle Hidden -PassThru

try {
    Esperar-Http 'http://127.0.0.1:8000/api/salud' { param($r) $r.Content -match 'masterexpress-api' }
    Esperar-Http 'http://127.0.0.1:5173/registro/institucion' { param($r) $r.StatusCode -eq 200 }
} catch {
    Detener-Demo
    throw
}

Write-Output ''
Write-Output 'Demo lista. Correo local, sin Resend.'
Write-Output 'Chrome: http://127.0.0.1:5173/registro/institucion'
Write-Output 'Activación: el enlace llega a http://127.0.0.1:8026/'
Write-Output 'Aprobar la última solicitud pendiente:'
Write-Output '  powershell -ExecutionPolicy Bypass -File scripts\demo-registro-institucion.ps1 -Aprobar'
Write-Output 'Cierra esta ventana para detener MySQL, la API, Vite y el correo.'
Write-Output ''

try {
    while ($true) {
        foreach ($proceso in $procesos) {
            if ($proceso.HasExited) { throw "$($proceso.ProcessName) se detuvo." }
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Detener-Demo
}
