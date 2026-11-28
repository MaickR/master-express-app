# Arranque persistente de la instancia de aceptación existente. No migra, siembra ni prueba datos.
param([switch]$GuardarConfiguracion, [switch]$SoloComprobar, [switch]$ReiniciarWebApi, [switch]$EstablecerClave)
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $raiz 'apps\api'
$carpetaLocal = Join-Path $env:LOCALAPPDATA 'MasterExpress'
$archivo = Join-Path $carpetaLocal 'aceptacion-local.dpapi'
$archivoProcesos = Join-Path $carpetaLocal 'aceptacion-procesos.json'
Add-Type -AssemblyName System.Security

function Buscar-Pid([int]$Puerto) {
    foreach ($linea in (& netstat -ano -p tcp)) {
        if ($linea -match "^\s*TCP\s+127\.0\.0\.1:$Puerto\s+\S+\s+LISTENING\s+(\d+)\s*$") { return [int]$Matches[1] }
    }
    return 0
}
function Validar-Configuracion($Configuracion) {
    if ($Configuracion.version -ne 1 -or $Configuracion.entorno.APP_ENV -ne 'testing' -or
        $Configuracion.entorno.DB_CONNECTION -ne 'mysql_pruebas' -or
        $Configuracion.entorno.ME_MYSQL_TEST_PORT -ne '3328' -or
        $Configuracion.entorno.MAIL_MAILER -ne 'array' -or
        $Configuracion.entorno.SPA_ALLOWED_ORIGINS -ne 'http://127.0.0.1:5188' -or
        -not (Test-Path -LiteralPath $Configuracion.directorioDatos -PathType Container)) {
        throw 'La configuración no corresponde a la instancia de aceptación autorizada.'
    }
    $esperado = [IO.Path]::GetFullPath((Join-Path $Configuracion.carpeta 'mysql')).TrimEnd('\', '/')
    if ([IO.Path]::GetFullPath($Configuracion.directorioDatos).TrimEnd('\', '/') -ne $esperado) {
        throw 'El almacenamiento no corresponde a la instancia existente.'
    }
}
if ($GuardarConfiguracion) {
    $entrada = [Console]::In.ReadToEnd()
    $configuracion = $entrada | ConvertFrom-Json
    Validar-Configuracion $configuracion
    New-Item -ItemType Directory -Path $carpetaLocal -Force | Out-Null
    $bytes = [Text.Encoding]::UTF8.GetBytes($entrada)
    $protegido = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($archivo, $protegido)
    [Array]::Clear($bytes, 0, $bytes.Length)
    $entrada = $null
    @{ web = (Buscar-Pid 5188); api = (Buscar-Pid 8008); mysql = (Buscar-Pid 3328) } |
        ConvertTo-Json | Set-Content -LiteralPath $archivoProcesos -Encoding UTF8
    Write-Host 'PASS Configuración cifrada para el usuario Windows actual. No contiene la contraseña de Ernesto.'
    exit 0
}
if (-not (Test-Path -LiteralPath $archivo)) { throw 'Falta registrar la instancia existente; no se creará otra base.' }
$bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($archivo), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
$configuracion = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
[Array]::Clear($bytes, 0, $bytes.Length)
Validar-Configuracion $configuracion
foreach ($propiedad in $configuracion.entorno.PSObject.Properties) {
    [Environment]::SetEnvironmentVariable($propiedad.Name, [string]$propiedad.Value, 'Process')
}
if ($EstablecerClave) {
    & (Join-Path $PSScriptRoot 'establecer-clave-qa.ps1') -CuentaId 27 -CarpetaResultado $configuracion.carpeta
    exit $LASTEXITCODE
}
function Comprobar-Identidad {
    Push-Location $api
    try {
        $salida = '{"accion":"diagnostico-ernesto"}' | & php tests/soporte-admin-core.php
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo validar la identidad de aceptación.' }
        $identidad = $salida | ConvertFrom-Json
        if ($identidad.cuentas_objetivo -ne 1 -or $identidad.cuentas[0].id -ne 27 -or
            -not $identidad.cuentas[0].activa -or -not $identidad.cuentas[0].principal -or
            $identidad.cuentas[0].roles -notcontains 'administrador' -or
            [IO.Path]::GetFullPath($identidad.directorio_datos).TrimEnd('\', '/') -ne
                [IO.Path]::GetFullPath($configuracion.directorioDatos).TrimEnd('\', '/')) {
            throw 'La base o la identidad no coinciden; no se modificaron cuentas.'
        }
        return $identidad
    } finally { Pop-Location }
}
if ($SoloComprobar) {
    $identidad = Comprobar-Identidad
    Write-Host "PASS MySQL 3328, masterexpress_control_test; cuenta $($identidad.cuentas[0].id), Administrador y principal."
    exit 0
}
if (-not (Buscar-Pid 3328)) {
    $mysql = 'C:\Program Files\MySQL\MySQL Server 9.1\bin\mysqld.exe'
    Start-Process -FilePath $mysql -ArgumentList @('--no-defaults', "--datadir=`"$($configuracion.directorioDatos)`"", '--port=3328', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin', '--console') -WindowStyle Hidden | Out-Null
    for ($intento = 0; $intento -lt 100 -and -not (Buscar-Pid 3328); $intento++) { Start-Sleep -Milliseconds 250 }
}
$identidad = Comprobar-Identidad
$anteriores = if (Test-Path -LiteralPath $archivoProcesos) { Get-Content -LiteralPath $archivoProcesos -Raw | ConvertFrom-Json } else { $null }
if ($ReiniciarWebApi) {
    foreach ($servicio in @(@{ nombre = 'api'; puerto = 8008; ejecutable = 'php' }, @{ nombre = 'web'; puerto = 5188; ejecutable = 'node' })) {
        $idActual = Buscar-Pid $servicio.puerto
        if ($idActual) {
            if (-not $anteriores -or $idActual -ne $anteriores.($servicio.nombre) -or
                (Get-Process -Id $idActual).ProcessName -ne $servicio.ejecutable) {
                throw 'El puerto pertenece a un proceso no registrado; no se detendrá.'
            }
            Stop-Process -Id $idActual
        }
    }
}
if (-not (Buscar-Pid 8008)) {
    Start-Process -FilePath (Get-Command php).Source -ArgumentList @('-S', '127.0.0.1:8008', '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php') -WorkingDirectory (Join-Path $api 'public') -WindowStyle Hidden | Out-Null
}
if (-not (Buscar-Pid 5188)) {
    Start-Process -FilePath (Get-Command node).Source -ArgumentList @("`"$(Join-Path $raiz 'node_modules\vite\bin\vite.js')`"", '--config', 'apps/web/vite.config.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort') -WorkingDirectory $raiz -WindowStyle Hidden | Out-Null
}
for ($intento = 0; $intento -lt 100; $intento++) {
    try {
        $salud = Invoke-RestMethod 'http://127.0.0.1:8008/api/salud'
        $web = Invoke-WebRequest 'http://127.0.0.1:5188/' -UseBasicParsing
        if ($salud.servicio -eq 'masterexpress-api' -and $web.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Milliseconds 250
}
if ($intento -ge 100) { throw 'Los servicios no respondieron; no se modificaron credenciales.' }
@{ web = (Buscar-Pid 5188); api = (Buscar-Pid 8008); mysql = (Buscar-Pid 3328) } |
    ConvertTo-Json | Set-Content -LiteralPath $archivoProcesos -Encoding UTF8
Write-Host 'PASS http://127.0.0.1:5188/ -> API 8008 -> MySQL 3328. Arranque sin seeders, migraciones ni cambios de contraseña.'
