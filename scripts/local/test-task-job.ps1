$ErrorActionPreference = 'Stop'
$directory = Join-Path ([IO.Path]::GetTempPath()) ('chatbot-task-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $directory | Out-Null
$owner = $null
$pids = @()
try {
    $worker = Join-Path $directory 'worker.cjs'
    @'
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
fs.writeFileSync(path.join(__dirname,'pids.json'),JSON.stringify([process.pid,child.pid]));
setInterval(()=>{},1000);
'@ | Set-Content -LiteralPath $worker
    $runner = Join-Path $directory 'runner.ps1'
    @'
param($Source,$Node,$Worker,$Directory)
$ErrorActionPreference='Stop'
Add-Type -Path $Source
exit [ChatbotTaskProcessJob]::Run($Node,$Worker,$Directory,(Join-Path $Directory 'worker.log'))
'@ | Set-Content -LiteralPath $runner
    $shell = (Get-Command pwsh.exe).Source
    $source = Join-Path $PSScriptRoot 'TaskProcessJob.cs'
    $node = (Get-Command node.exe).Source
    $arguments = @('-NoProfile', '-NonInteractive', '-File', ('"' + $runner + '"'), '-Source', ('"' + $source + '"'), '-Node', ('"' + $node + '"'), '-Worker', ('"' + $worker + '"'), '-Directory', ('"' + $directory + '"'))
    $owner = Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        if ($owner.HasExited) { throw 'Job owner exited before starting its children.' }
        try { $pids = @(Get-Content -LiteralPath (Join-Path $directory 'pids.json') -Raw | ConvertFrom-Json) } catch { $pids = @() }
        if ($pids.Count -eq 2) { break }
        Start-Sleep -Milliseconds 200
    }
    if ($pids.Count -ne 2) { throw 'Owned process tree did not start.' }
    foreach ($ownedPid in $pids) { if (-not (Get-Process -Id $ownedPid -ErrorAction SilentlyContinue)) { throw 'Child exited before the owner-stop probe.' } }
    Stop-Process -Id $owner.Id -Force
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline -and @(Get-Process -Id $pids -ErrorAction SilentlyContinue).Count) { Start-Sleep -Milliseconds 100 }
    if (@(Get-Process -Id $pids -ErrorAction SilentlyContinue).Count) { throw 'Killing the owner left orphaned Node processes.' }
    Write-Output 'PASS: forced task-owner termination stops the complete Node process tree.'
} finally {
    if ($owner -and -not $owner.HasExited) { Stop-Process -Id $owner.Id -Force -ErrorAction SilentlyContinue }
    foreach ($ownedPid in $pids) { Stop-Process -Id $ownedPid -Force -ErrorAction SilentlyContinue }
    $resolved = [IO.Path]::GetFullPath($directory)
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside the test temporary directory.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
