/**
 * Fetches the purchase order PDF and delivers it to the user.
 */
export async function downloadPOPdf(
  orderId:     string,
  orderNumber: string,
): Promise<void> {
  const res = await fetch(`/api/purchase-orders/${encodeURIComponent(orderId)}/pdf`)

  if (!res.ok) {
    let message = 'Erreur lors de la génération du bon de commande.'
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {}
    throw new Error(message)
  }

  const blob     = await res.blob()
  const filename = `BC_${orderNumber.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: `BC ${orderNumber}`, files: [file] })
        return
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Fetches the bon de livraison PDF for a given order ID and delivers it to the user.
 * Supports native share sheet on mobile (WhatsApp, email…) with desktop fallback.
 */
export async function downloadBLPdf(
  orderId:     string,
  orderNumber: string,
): Promise<void> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/bl`)

  if (!res.ok) {
    let message = 'Erreur lors de la génération du bon de livraison.'
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {}
    throw new Error(message)
  }

  const blob     = await res.blob()
  const filename = `BL_${orderNumber.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: `BL ${orderNumber}`, files: [file] })
        return
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Fetches the invoice PDF for a given sale/quote ID and delivers it to the user.
 *
 * On mobile browsers that support the Web Share API with files (Chrome/Safari),
 * this opens the native share sheet so the user can send the PDF directly via
 * WhatsApp, email, AirDrop, etc.  On desktop (or when Web Share is unavailable)
 * it falls back to a standard file download.
 */
export async function downloadInvoicePdf(
  saleId:    string,
  docNumber: string,
): Promise<void> {
  const res = await fetch(`/api/pdf/invoice/${encodeURIComponent(saleId)}`)

  if (!res.ok) {
    let message = 'Erreur lors de la génération du PDF.'
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {}
    throw new Error(message)
  }

  const blob     = await res.blob()
  const filename = `Facture_${docNumber.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`

  // ── Web Share API (mobile) ────────────────────────────────────────────────
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Facture ${docNumber}`,
          files: [file],
        })
        return
      } catch (e) {
        // AbortError = user dismissed share sheet — treat as success (no download needed)
        if ((e as DOMException).name === 'AbortError') return
        // Any other error: fall through to file download
      }
    }
  }

  // ── File download (desktop / fallback) ───────────────────────────────────
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
