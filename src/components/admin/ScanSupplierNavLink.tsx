import React from 'react'
import Link from 'next/link'

/**
 * Sidebar link to the interactive scan-supplier wizard.
 * Rendered in afterNavLinks slot of the Payload admin layout.
 */
export default function ScanSupplierNavLink(): React.JSX.Element {
  return (
    <nav
      style={{
        marginTop: 4,
        paddingTop: 4,
      }}
    >
      <Link
        href="/admin/scan-supplier"
        style={{
          display: 'block',
          padding: '8px 12px',
          color: 'var(--theme-text)',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 500,
          borderRadius: 4,
        }}
      >
        Scanner un fournisseur
      </Link>
    </nav>
  )
}
