$script = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'backup.ps1')
if ($script -notmatch '\$Path') { throw 'The backup script must consume the path parameter.' }
if ($script -match 'Invoke-Expression|iex') { throw 'The backup script must not evaluate path input as code.' }
if ($script -notmatch '--\s+\$Path') { throw 'The path must be passed as one literal argument.' }
