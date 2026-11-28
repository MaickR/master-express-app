# Entrada interactiva nativa de Windows. El valor viaja solo por una tubería privada a Laravel.
param(
    [Parameter(Mandatory = $true)][ValidateRange(1, 2147483647)][int]$CuentaId,
    [Parameter(Mandatory = $true)][string]$CarpetaResultado
)
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'MasterExpress - Contraseña de Ernesto QA'
$api = Join-Path (Split-Path $PSScriptRoot -Parent) 'apps\api'
$resultado = Join-Path $CarpetaResultado 'preparacion-ernesto.json'
$codigo = 1
$primera = $null
$segunda = $null
$bstrPrimera = [IntPtr]::Zero
$bstrSegunda = [IntPtr]::Zero
try {
    Write-Host 'Cuenta QA existente. No se crea otra identidad ni se cambia el correo.'
    Write-Host 'Introduce la contraseña que ya elegiste. Verás asteriscos.'
    $primera = Read-Host 'Contraseña elegida' -AsSecureString
    $segunda = Read-Host 'Confirma la misma contraseña' -AsSecureString
    $bstrPrimera = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($primera)
    $bstrSegunda = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segunda)
    $datos = @{
        password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrPrimera)
        password_confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrSegunda)
    }
    $inicio = New-Object Diagnostics.ProcessStartInfo
    $inicio.FileName = (Get-Command php).Source
    $inicio.Arguments = "artisan cuentas:principal-qa $CuentaId --clave-stdin"
    $inicio.WorkingDirectory = $api
    $inicio.UseShellExecute = $false
    $inicio.CreateNoWindow = $true
    $inicio.RedirectStandardInput = $true
    $inicio.RedirectStandardOutput = $true
    $inicio.RedirectStandardError = $true
    $proceso = New-Object Diagnostics.Process
    $proceso.StartInfo = $inicio
    [void]$proceso.Start()
    $bytes = [Text.Encoding]::UTF8.GetBytes(($datos | ConvertTo-Json -Compress))
    $proceso.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
    $proceso.StandardInput.BaseStream.Flush()
    [Array]::Clear($bytes, 0, $bytes.Length)
    $proceso.StandardInput.Close()
    $datos.Clear()
    $salida = $proceso.StandardOutput.ReadToEnd()
    $errorSeguro = $proceso.StandardError.ReadToEnd()
    $proceso.WaitForExit()
    $codigo = $proceso.ExitCode
    if ($codigo -eq 0) {
        Write-Host 'PASS: Laravel guardó y comprobó la contraseña. Cuenta e historial conservados.' -ForegroundColor Green
    } elseif ($salida -match 'límites|coincide') {
        Write-Host 'FAIL: la confirmación no coincide o no cumple la regla existente: mínimo 12 caracteres, máximo 72 bytes y sin caracteres nulos.' -ForegroundColor Yellow
    } else {
        Write-Host 'FAIL: Laravel no completó la preparación. No se creó otra cuenta. Revisa la conexión y el ID autorizado.' -ForegroundColor Yellow
    }
} catch {
    Write-Host 'FAIL: no se pudo completar la entrada privada. No se muestran valores ni detalles sensibles.' -ForegroundColor Red
} finally {
    if ($bstrPrimera -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrPrimera) }
    if ($bstrSegunda -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrSegunda) }
    if ($primera) { $primera.Dispose() }
    if ($segunda) { $segunda.Dispose() }
    $salida = $null
    $errorSeguro = $null
    @{ id = $CuentaId; resultado = $(if ($codigo -eq 0) { 'PASS' } else { 'FAIL' }); codigo = $codigo } |
        ConvertTo-Json -Compress | Set-Content -LiteralPath $resultado -Encoding UTF8
}
Write-Host 'Puedes cerrar esta ventana. No escribas tu contraseña en la línea de comandos.'
exit $codigo
