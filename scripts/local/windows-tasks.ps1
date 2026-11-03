[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet('Install', 'Status', 'Uninstall')][string]$Action = 'Install',
    [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')][string]$BackupTime = '20:00'
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runner = Join-Path $PSScriptRoot 'run-task.ps1'
$names = @('Chatbot Local Startup', 'Chatbot Local Backup')
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
foreach ($name in $names) {
    $existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($existing -and ($existing.Actions.Arguments -notcontains ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $runner + '" -Mode ' + $(if ($name -like '*Startup') { 'Startup' } else { 'Backup' })))) {
        throw "Task '$name' belongs to another installation; it was left untouched."
    }
}
if ($Action -eq 'Status') {
    foreach ($name in $names) {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        if ($task) {
            $info = Get-ScheduledTaskInfo -TaskName $name
            [pscustomobject]@{ Name = $name; State = [string]$task.State; LastResult = $info.LastTaskResult; LastRun = $info.LastRunTime; NextRun = $info.NextRunTime }
        } else { [pscustomobject]@{ Name = $name; State = 'NotInstalled' } }
    }
    return
}
if ($Action -eq 'Uninstall') {
    foreach ($name in $names) {
        if ((Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) -and $PSCmdlet.ShouldProcess($name, 'Remove chatbot scheduled task')) {
            Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $name -Confirm:$false
        }
    }
    return
}
$node = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $root 'dist/server/index.js'))) { throw 'Run npm run build first.' }
if (-not (Test-Path -LiteralPath (Join-Path $root '.env'))) { throw 'Run npm run setup:local first.' }
$directory = Join-Path $root 'data/local-runtime'
if (-not $PSCmdlet.ShouldProcess($identity, 'Install current-user chatbot startup and daily backup tasks')) { return }
New-Item -ItemType Directory -Path $directory -Force | Out-Null
@{ root = $root; node = $node; backupTime = $BackupTime; installedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'tasks.json') -Encoding UTF8
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$modernShell = Get-Command pwsh.exe -ErrorAction SilentlyContinue
$shell = if ($modernShell) { $modernShell.Source } else { Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe' }
foreach ($mode in @('Startup', 'Backup')) {
    $name = 'Chatbot Local ' + $mode
    $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $runner + '" -Mode ' + $mode
    $taskAction = New-ScheduledTaskAction -Execute $shell -Argument $arguments -WorkingDirectory $env:USERPROFILE
    $triggers = @(New-ScheduledTaskTrigger -AtLogOn -User $identity)
    $limit = [TimeSpan]::Zero
    if ($mode -eq 'Backup') {
        $triggers += New-ScheduledTaskTrigger -Daily -At $BackupTime
        $limit = New-TimeSpan -Hours 1
    }
    # Retry if the removable project drive or Ollama is not available at sign-in.
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 144 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit $limit
    Register-ScheduledTask -TaskName $name -Action $taskAction -Trigger $triggers -Settings $settings -Principal $principal -Description "Personal local chatbot $mode for $root. Runs only as the signed-in user." -Force | Out-Null
}
Write-Output "Installed startup at sign-in and backups at $BackupTime local time plus sign-in. Run automation:status to inspect."
