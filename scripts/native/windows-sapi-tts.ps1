param(
  [Parameter(Mandatory = $true)][string]$InputTextPath,
  [Parameter(Mandatory = $true)][string]$OutputWavePath,
  [int]$Rate = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = [System.IO.File]::ReadAllText($InputTextPath)
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $synthesizer.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $synthesizer.SetOutputToWaveFile($OutputWavePath)
  $synthesizer.Speak($text)
} finally {
  $synthesizer.Dispose()
}
