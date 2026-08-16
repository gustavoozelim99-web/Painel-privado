# Libera o painel para ser aberto no celular, na mesma Wi-Fi.
# Precisa de administrador. Para desfazer:  .\rede-do-celular.ps1 -Desfazer
param([switch]$Desfazer)

$ErrorActionPreference = "Stop"
$REGRA = "Painel do brain (4310)"
$PORTA = 4310

$euSouAdmin = (New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent())
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $euSouAdmin) {
  Write-Host ""
  Write-Host "  Esta janela nao tem poder de administrador." -ForegroundColor Red
  Write-Host "  Feche e rode de novo pelo comando que o Claude passou."
  Write-Host ""
  Read-Host "  Enter para fechar"
  exit 1
}

$perfil = Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" } | Select-Object -First 1
if (-not $perfil) { $perfil = Get-NetConnectionProfile | Select-Object -First 1 }

if ($Desfazer) {
  Write-Host ""
  Write-Host "  Desfazendo..." -ForegroundColor Yellow
  Get-NetFirewallRule -DisplayName $REGRA -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Write-Host "  - regra de firewall removida"
  Set-NetConnectionProfile -Name $perfil.Name -NetworkCategory Public
  Write-Host "  - rede '$($perfil.Name)' voltou a ser Publica"
  Write-Host ""
  Write-Host "  Tudo como estava antes." -ForegroundColor Green
  Write-Host ""
  Read-Host "  Enter para fechar"
  exit 0
}

Write-Host ""
Write-Host "  Rede: $($perfil.Name)  (hoje: $($perfil.NetworkCategory))" -ForegroundColor Cyan

# 1. a Wi-Fi de casa como Privada — e so isso ja tira o bloqueio do node,
#    porque as regras que bloqueiam valem so no perfil Publico
Set-NetConnectionProfile -Name $perfil.Name -NetworkCategory Private
Write-Host "  - rede marcada como Privada"

# 2. libera a porta, e SO no perfil privado
Get-NetFirewallRule -DisplayName $REGRA -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $REGRA -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort $PORTA -Profile Private | Out-Null
Write-Host "  - porta $PORTA liberada, so na rede privada"

# 3. garante o servidor de pe
if (-not (Get-Process node -ErrorAction SilentlyContinue)) {
  Start-Process node -ArgumentList "$PSScriptRoot\server.js" -WindowStyle Hidden
  Start-Sleep -Seconds 2
  Write-Host "  - servidor iniciado"
} else {
  Write-Host "  - servidor ja estava rodando"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.InterfaceAlias -eq $perfil.InterfaceAlias } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   No celular, na mesma Wi-Fi, abra:" -ForegroundColor Green
Write-Host ""
Write-Host "       http://$($ip):$PORTA" -ForegroundColor White
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Lembre: isso so vale com o PC ligado e nesta Wi-Fi."
Write-Host "  Para desfazer tudo:  .\rede-do-celular.ps1 -Desfazer"
Write-Host ""
Read-Host "  Enter para fechar"
