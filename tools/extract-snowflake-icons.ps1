param(
  [Parameter(Mandatory = $true)][string]$Template,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
# PowerPoint can attach to an existing interactive instance. Never close or
# interfere with a presentation that the user already has open.
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) {
  [Console]::Error.WriteLine('PowerPoint が使用中のため Snowflake のサービスアイコン変換を省略しました。')
  exit 2
}
if (-not [type]::GetTypeFromProgID('PowerPoint.Application')) {
  [Console]::Error.WriteLine('PowerPoint が見つからないため Snowflake のサービスアイコン変換を省略しました。')
  exit 2
}
$specs = @(
  @{ Slide = 80; Label = 'Virtual Warehouse'; Shape = 'Google Shape;4618;p101'; File = 'Snowflake-Virtual-Warehouse.svg' },
  @{ Slide = 80; Label = 'Task'; Shape = 'Google Shape;4613;p101'; File = 'Snowflake-Task.svg' },
  @{ Slide = 80; Label = 'Pipe'; Shape = 'Google Shape;4629;p101'; File = 'Snowflake-Pipe.svg' },
  @{ Slide = 80; Label = 'Stream'; Shape = 'Google Shape;4608;p101'; File = 'Snowflake-Stream.svg' },
  @{ Slide = 80; Label = 'Snowflake Database'; Shape = 'Google Shape;4598;p101'; File = 'Snowflake-Database.svg' },
  @{ Slide = 74; Label = 'Dynamic Tables'; Shape = 'Google Shape;3038;p95'; File = 'Snowflake-Dynamic-Tables.svg' },
  @{ Slide = 74; Label = 'Snowflake Horizon'; Shape = 'Google Shape;3035;p95'; File = 'Snowflake-Horizon.svg' },
  @{ Slide = 74; Label = 'Snowflake Cortex'; Shape = 'Google Shape;3192;p95'; File = 'Snowflake-Cortex.svg' },
  @{ Slide = 74; Label = 'Snowflake Intelligence'; Shape = 'Google Shape;3212;p95'; File = 'Snowflake-Intelligence.svg' }
)
$application = $null
$presentation = $null
try {
  $application = New-Object -ComObject PowerPoint.Application
  $application.DisplayAlerts = 1
  $presentation = $application.Presentations.Open((Resolve-Path -LiteralPath $Template).Path, -1, 0, 0)
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  foreach ($spec in $specs) {
    $slide = $presentation.Slides.Item($spec.Slide)
    $labels = @($slide.Shapes | Where-Object { $_.HasTextFrame -eq -1 -and $_.TextFrame.HasText -eq -1 -and (($_.TextFrame.TextRange.Text -replace '\s+', ' ').Trim() -eq $spec.Label) })
    if ($labels.Count -ne 1) { throw "Snowflake template label not unique: $($spec.Label)" }
    $shape = $slide.Shapes.Item($spec.Shape)
    $label = $labels[0]
    $distance = [Math]::Abs(($shape.Left + $shape.Width / 2) - ($label.Left + $label.Width / 2))
    $gap = $label.Top - ($shape.Top + $shape.Height)
    if ($distance -gt 16 -or $gap -lt 0 -or $gap -gt 25) { throw "Snowflake template icon no longer matches label: $($spec.Label)" }
    $shape.Export((Join-Path $OutputDirectory $spec.File), 6) # ppShapeFormatSVG
  }
  Write-Output "snowflake: $($specs.Count) SVG icons"
} finally {
  if ($presentation) { $presentation.Close() }
  if ($application -and $application.Presentations.Count -eq 0) { $application.Quit() }
}
