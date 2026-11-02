param(
  [Parameter(Mandatory = $true)][string]$OutputPngPath,
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 0,
  [int]$Height = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ($Width -le 0 -or $Height -le 0) {
  $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $X = $bounds.X
  $Y = $bounds.Y
  $Width = $bounds.Width
  $Height = $bounds.Height
}
$bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($X, $Y, 0, 0, $bitmap.Size)
  $bitmap.Save($OutputPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
[Console]::Out.Write("$Width,$Height")
