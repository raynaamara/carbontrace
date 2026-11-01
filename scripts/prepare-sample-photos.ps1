$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $projectRoot 'src\assets\samples'
$outputDirectory = Join-Path $sourceDirectory 'optimized'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } |
    Select-Object -First 1
if ($null -eq $jpegEncoder) { throw 'JPEG encoder is not available.' }

$samples = @()
foreach ($number in 1..12) {
    $id = 'CT-{0:D3}' -f $number
    $samples += [PSCustomObject]@{ Id = $id; File = $id + '_01.png' }
}
foreach ($prefix in @('PET', 'CRD', 'DRYWALL')) {
    foreach ($number in 1..40) {
        $id = 'SYN-{0}-{1:D3}' -f $prefix, $number
        $samples += [PSCustomObject]@{ Id = $id; File = $id + '.png' }
    }
}

foreach ($sample in $samples) {
    $sampleId = $sample.Id
    $sourcePath = Join-Path $sourceDirectory $sample.File
    $outputPath = Join-Path $outputDirectory ($sampleId + '_01.jpg')
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw ('Missing sample photo: ' + $sourcePath)
    }

    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
    $image = [System.Drawing.Image]::FromFile($sourcePath)
    try {
        $scale = [Math]::Min([double]1, [double](1024.0 / [Math]::Max($image.Width, $image.Height)))
        $width = [int][Math]::Max(1, [Math]::Round($image.Width * $scale))
        $height = [int][Math]::Max(1, [Math]::Round($image.Height * $scale))
        $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($image, 0, 0, $width, $height)
            } finally {
                $graphics.Dispose()
            }

            $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
            try {
                $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
                    [System.Drawing.Imaging.Encoder]::Quality, [long]85
                )
                $bitmap.Save($outputPath, $jpegEncoder, $parameters)
            } finally {
                $parameters.Dispose()
            }
        } finally {
            $bitmap.Dispose()
        }
    } finally {
        $image.Dispose()
    }

    if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $sourceHash) {
        throw ('Original photo was unexpectedly modified: ' + $sourcePath)
    }
    $displayImage = [System.Drawing.Image]::FromFile($outputPath)
    try {
        if ([Math]::Max($displayImage.Width, $displayImage.Height) -gt 1024) {
            throw ('Display photo exceeds 1024 pixels: ' + $outputPath)
        }
        [PSCustomObject]@{
            Sample = $sampleId
            OriginalKB = [Math]::Round((Get-Item -LiteralPath $sourcePath).Length / 1KB, 1)
            DisplayKB = [Math]::Round((Get-Item -LiteralPath $outputPath).Length / 1KB, 1)
            Width = $displayImage.Width
            Height = $displayImage.Height
            OriginalUnchanged = $true
        }
    } finally {
        $displayImage.Dispose()
    }
}
