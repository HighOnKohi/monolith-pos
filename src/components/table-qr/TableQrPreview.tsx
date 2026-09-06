import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  X,
  Download,
  Printer,
  ExternalLink,
  Copy,
  Check,
  QrCode as QrIcon,
  ShieldCheck,
} from 'lucide-react'
import { getTableQrUrl, getQrFilename, getTableLabel } from './tableQrUtils'
import { printSingleQr } from './tableQrPrinter'

interface TableQrPreviewProps {
  tableId: number
  tableNum: number
  guestCapacity?: number
  onClose: () => void
}

export function TableQrPreview({
  tableId,
  tableNum,
  guestCapacity,
  onClose,
}: TableQrPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const url = getTableQrUrl(tableId)
  const label = getTableLabel(tableNum)
  const filename = getQrFilename(tableNum)

  // Render high-res QR code onto the canvas
  useEffect(() => {
    if (!canvasRef.current) return

    QRCode.toCanvas(canvasRef.current, url, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#14274E',
        light: '#FFFFFF',
      },
    }).catch((err) => {
      console.error('[TableQrPreview] Failed to generate QR code canvas:', err)
    })
  }, [url])

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Copy canonical QR destination URL
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Download high-resolution PNG image
  const handleDownloadPng = async () => {
    try {
      setIsDownloading(true)
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#14274E',
          light: '#FFFFFF',
        },
      })
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('[TableQrPreview] PNG download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  // Download vector SVG image
  const handleDownloadSvg = async () => {
    try {
      setIsDownloading(true)
      const svgString = await QRCode.toString(url, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#14274E',
          light: '#FFFFFF',
        },
      })
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `table-${String(tableNum).padStart(2, '0')}-qr.svg`
      link.href = blobUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('[TableQrPreview] SVG download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  // Print physical single card
  const handlePrint = async () => {
    try {
      setIsPrinting(true)
      await printSingleQr(tableId, tableNum)
    } catch (err) {
      console.error('[TableQrPreview] Print failed:', err)
    } finally {
      setIsPrinting(false)
    }
  }

  // Test QR destination in a new tab
  const handleTestDestination = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="table-qr-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`QR Code for ${label}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="table-qr-modal-card">
        {/* Modal Header */}
        <div className="table-qr-modal-header">
          <div className="table-qr-header-info">
            <div className="table-qr-icon-badge">
              <QrIcon className="w-5 h-5 text-[#14274E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="table-qr-title">{label}</h3>
                {guestCapacity ? (
                  <span className="table-qr-capacity-pill">
                    {guestCapacity} Seats
                  </span>
                ) : null}
              </div>
              <p className="table-qr-subtitle">
                Canonical Table ID: <span className="font-mono font-semibold text-[#14274E]">#{tableId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="table-qr-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / QR Canvas Preview */}
        <div className="table-qr-preview-body">
          <div className="table-qr-canvas-container">
            <div className="table-qr-canvas-wrapper">
              <canvas ref={canvasRef} className="table-qr-canvas" />
            </div>
            <div className="table-qr-hint">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified deterministic link • High error correction (Level M)</span>
            </div>
          </div>

          {/* Canonical URL bar */}
          <div className="table-qr-url-box">
            <div className="table-qr-url-text" title={url}>
              {url}
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="table-qr-copy-btn"
              title="Copy URL"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Action Buttons Grid */}
          <div className="table-qr-actions-grid">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="table-qr-btn table-qr-btn-primary"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Saving...' : 'Download PNG'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={isDownloading}
              className="table-qr-btn table-qr-btn-secondary"
            >
              <Download className="w-4 h-4" />
              <span>SVG Vector</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="table-qr-btn table-qr-btn-secondary"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Preparing...' : 'Print Card'}</span>
            </button>

            <button
              type="button"
              onClick={handleTestDestination}
              className="table-qr-btn table-qr-btn-secondary"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Test Link</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="table-qr-modal-footer">
          <span className="text-[11px] text-[#9BA4B4]">
            Filename: <code className="font-mono text-[#394867]">{filename}</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#394867] hover:text-[#14274E] transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
