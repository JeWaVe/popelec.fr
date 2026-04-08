import React from 'react'
import Link from 'next/link'

/**
 * Sidebar link to the custom supplier import view.
 * Rendered in afterNavLinks slot of the Payload admin layout.
 */
export default function ImportSupplierNavLink(): React.JSX.Element {
  return (
    <nav
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px solid var(--theme-elevation-150)',
      }}
    >
      <Link
        href="/admin/import-supplier"
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
        Importer fournisseur
      </Link>
    </nav>
  )
}
