import type { Payload } from 'payload'
import React from 'react'
import { fetchDashboardData } from './dashboard-queries'
import type { RecentOrderRow, RecentQuoteRow, LowStockAlert } from './dashboard-types'
import { formatPrice } from '@/lib/formatPrice'
import { OrderStatuses, type OrderStatus } from '@/types/enums/order-status'
import { QuoteRequestStatuses, type QuoteRequestStatus } from '@/types/enums/quote-request-status'
import { ProductStatuses, type ProductStatus } from '@/types/enums/product-status'
import { UserRoles, type UserRole } from '@/types/enums/user-role'
import styles from './Dashboard.module.css'

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatuses.Pending]: 'En attente',
  [OrderStatuses.Paid]: 'Payé',
  [OrderStatuses.Processing]: 'En préparation',
  [OrderStatuses.Shipped]: 'Expédié',
  [OrderStatuses.Delivered]: 'Livré',
  [OrderStatuses.Cancelled]: 'Annulé',
  [OrderStatuses.Refunded]: 'Remboursé',
}

const ORDER_STATUS_CSS: Record<OrderStatus, string> = {
  [OrderStatuses.Pending]: styles.badgePending,
  [OrderStatuses.Paid]: styles.badgePaid,
  [OrderStatuses.Processing]: styles.badgeProcessing,
  [OrderStatuses.Shipped]: styles.badgeShipped,
  [OrderStatuses.Delivered]: styles.badgeDelivered,
  [OrderStatuses.Cancelled]: styles.badgeCancelled,
  [OrderStatuses.Refunded]: styles.badgeRefunded,
}

const QUOTE_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  [QuoteRequestStatuses.New]: 'Nouveau',
  [QuoteRequestStatuses.Processing]: 'En cours',
  [QuoteRequestStatuses.Sent]: 'Devis envoyé',
  [QuoteRequestStatuses.Accepted]: 'Accepté',
  [QuoteRequestStatuses.Rejected]: 'Refusé',
}

const QUOTE_STATUS_CSS: Record<QuoteRequestStatus, string> = {
  [QuoteRequestStatuses.New]: styles.badgeNew,
  [QuoteRequestStatuses.Processing]: styles.badgeProcessing,
  [QuoteRequestStatuses.Sent]: styles.badgeSent,
  [QuoteRequestStatuses.Accepted]: styles.badgeAccepted,
  [QuoteRequestStatuses.Rejected]: styles.badgeRejected,
}

const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  [ProductStatuses.Draft]: 'Brouillon',
  [ProductStatuses.Published]: 'Publié',
  [ProductStatuses.OutOfStock]: 'Rupture',
  [ProductStatuses.Archived]: 'Archivé',
}

const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRoles.Admin]: 'Admin',
  [UserRoles.Customer]: 'Client',
  [UserRoles.Professional]: 'Professionnel',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function Dashboard({ payload }: { payload: Payload }) {
  const data = await fetchDashboardData(payload)

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.sectionTitle}>Tableau de bord</h2>

      {/* KPI cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Commandes totales</span>
          <span className={styles.metricValue}>{data.metrics.totalOrders}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Chiffre d&apos;affaires TTC</span>
          <span className={styles.metricValue}>
            {formatPrice(data.metrics.totalRevenueTTC)}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Commandes en attente</span>
          <span className={`${styles.metricValue} ${data.metrics.pendingOrders > 0 ? styles.metricAccent : ''}`}>
            {data.metrics.pendingOrders}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Nouveaux devis</span>
          <span className={`${styles.metricValue} ${data.metrics.newQuoteRequests > 0 ? styles.metricAccent : ''}`}>
            {data.metrics.newQuoteRequests}
          </span>
        </div>
      </div>

      {/* Recent orders */}
      <h2 className={styles.sectionTitle}>Commandes récentes</h2>
      {data.recentOrders.length === 0 ? (
        <p className={styles.empty}>Aucune commande.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>N° Commande</th>
                <th>Client</th>
                <th>Total TTC</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o: RecentOrderRow) => (
                <tr key={o.id as number}>
                  <td>
                    <a href={`/admin/collections/orders/${o.id as number}`}>
                      {o.orderNumber as string}
                    </a>
                  </td>
                  <td>{o.customerEmail as string}</td>
                  <td>{formatPrice(o.totalTTC)}</td>
                  <td>
                    <span className={`${styles.badge} ${ORDER_STATUS_CSS[o.status]}`}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td>{formatDate(o.createdAt as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent quotes */}
      <h2 className={styles.sectionTitle}>Demandes de devis récentes</h2>
      {data.recentQuotes.length === 0 ? (
        <p className={styles.empty}>Aucune demande de devis.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Entreprise</th>
                <th>Email</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentQuotes.map((q: RecentQuoteRow) => (
                <tr key={q.id as number}>
                  <td>
                    <a href={`/admin/collections/quote-requests/${q.id as number}`}>
                      {q.contactName}
                    </a>
                  </td>
                  <td>{q.company || '—'}</td>
                  <td>{q.email as string}</td>
                  <td>
                    <span className={`${styles.badge} ${QUOTE_STATUS_CSS[q.status]}`}>
                      {QUOTE_STATUS_LABELS[q.status]}
                    </span>
                  </td>
                  <td>{formatDate(q.createdAt as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Low stock alerts */}
      <h2 className={styles.sectionTitle}>Alertes stock bas</h2>
      {data.lowStockAlerts.length === 0 ? (
        <p className={styles.empty}>Aucune alerte de stock.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Seuil</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStockAlerts.map((a: LowStockAlert) => (
                <tr
                  key={a.id as number}
                  className={(a.quantity as number) === 0 ? styles.alertRowZero : styles.alertRow}
                >
                  <td>
                    <a href={`/admin/collections/products/${a.id as number}`}>
                      {a.name}
                    </a>
                  </td>
                  <td>{a.sku as string}</td>
                  <td>{a.quantity as number}</td>
                  <td>{a.lowStockThreshold as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick stats */}
      <h2 className={styles.sectionTitle}>Statistiques</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statsCard}>
          <div className={styles.statsCardTitle}>Produits par statut</div>
          <ul className={styles.statsList}>
            {(Object.entries(data.productsByStatus) as [ProductStatus, number][]).map(
              ([status, count]) => (
                <li key={status} className={styles.statsRow}>
                  <span className={styles.statsLabel}>{PRODUCT_STATUS_LABELS[status]}</span>
                  <span className={styles.statsValue}>{count}</span>
                </li>
              ),
            )}
          </ul>
        </div>
        <div className={styles.statsCard}>
          <div className={styles.statsCardTitle}>Utilisateurs par rôle</div>
          <ul className={styles.statsList}>
            {(Object.entries(data.usersByRole) as [UserRole, number][]).map(
              ([role, count]) => (
                <li key={role} className={styles.statsRow}>
                  <span className={styles.statsLabel}>{USER_ROLE_LABELS[role]}</span>
                  <span className={styles.statsValue}>{count}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
