param([ValidateSet('Startup', 'Backup')][string]$Mode)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$settings = Get-Content -LiteralPath (Join-Path $root 'data/local-runtime/tasks.json') -Raw | ConvertFrom-Json
if ($settings.root -ne $root -or -not (Test-Path -LiteralPath $settings.node -PathType Leaf)) { throw 'Task runtime configuration does not match this checkout.' }
Set-Location -LiteralPath $root
$log = Join-Path $root ('data/local-runtime/' + $Mode.ToLowerInvariant() + '-task.log')
if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 5MB) {
    Copy-Item -LiteralPath $log -Destination "$log.previous" -Force
    Clear-Content -LiteralPath $log
}
Add-Type -Path (Join-Path $PSScriptRoot 'TaskProcessJob.cs')
$script = Join-Path $PSScriptRoot $(if ($Mode -eq 'Startup') { 'supervise.mjs' } else { 'backup.mjs' })
exit [ChatbotTaskProcessJob]::Run($settings.node, $script, $root, $log)
