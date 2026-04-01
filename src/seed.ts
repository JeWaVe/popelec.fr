import { getPayload } from 'payload'
import config from '../payload.config'
import { ProductStatuses } from './types/enums/product-status'
import { TVARates } from './types/enums/tva-rate'
import { UserRoles } from './types/enums/user-role'

const CATEGORIES = [
  { name: 'Moteurs', slug: 'moteurs', nameEn: 'Motors', sortOrder: 1 },
  { name: 'Variateurs & Contrôleurs', slug: 'variateurs', nameEn: 'Inverters & Controllers', sortOrder: 2 },
  { name: 'Disjoncteurs', slug: 'disjoncteurs', nameEn: 'Circuit Breakers', sortOrder: 3 },
  { name: 'Armoires électriques', slug: 'armoires', nameEn: 'Electrical Cabinets', sortOrder: 4 },
]

const PRODUCTS = [
  {
    name: 'Moteur asynchrone triphasé 1.5kW',
    slug: 'moteur-asynchrone-triphase-1-5kw',
    sku: 'MOT-AC-1500',
    shortDescription: 'Moteur électrique triphasé 1.5kW 1500 tr/min, classe IE2',
    priceHT: 18500, // 185.00€
    category: 'moteurs',
    weight: 12.5,
    specs: [
      { label: 'Puissance', value: '1.5', unit: 'kW', group: 'Électrique' },
      { label: 'Vitesse', value: '1500', unit: 'tr/min', group: 'Mécanique' },
      { label: 'Tension', value: '400', unit: 'V', group: 'Électrique' },
      { label: 'Classe', value: 'IE2', unit: '', group: 'Rendement' },
    ],
  },
  {
    name: 'Moteur asynchrone triphasé 3kW',
    slug: 'moteur-asynchrone-triphase-3kw',
    sku: 'MOT-AC-3000',
    shortDescription: 'Moteur électrique triphasé 3kW 1500 tr/min, classe IE2',
    priceHT: 28900,
    category: 'moteurs',
    weight: 22,
    specs: [
      { label: 'Puissance', value: '3', unit: 'kW', group: 'Électrique' },
      { label: 'Vitesse', value: '1500', unit: 'tr/min', group: 'Mécanique' },
      { label: 'Tension', value: '400', unit: 'V', group: 'Électrique' },
    ],
  },
  {
    name: 'Moteur asynchrone triphasé 5.5kW',
    slug: 'moteur-asynchrone-triphase-5-5kw',
    sku: 'MOT-AC-5500',
    shortDescription: 'Moteur électrique triphasé 5.5kW 1500 tr/min, classe IE3',
    priceHT: 45000,
    category: 'moteurs',
    weight: 38,
    specs: [
      { label: 'Puissance', value: '5.5', unit: 'kW', group: 'Électrique' },
      { label: 'Vitesse', value: '1500', unit: 'tr/min', group: 'Mécanique' },
      { label: 'Classe', value: 'IE3', unit: '', group: 'Rendement' },
    ],
  },
  {
    name: 'Moteur brushless BLDC 750W',
    slug: 'moteur-brushless-bldc-750w',
    sku: 'MOT-BL-750',
    shortDescription: 'Moteur brushless DC 750W haute efficacité avec driver intégré',
    priceHT: 34500,
    category: 'moteurs',
    weight: 4.2,
    specs: [
      { label: 'Puissance', value: '750', unit: 'W', group: 'Électrique' },
      { label: 'Tension', value: '48', unit: 'V DC', group: 'Électrique' },
    ],
  },
  {
    name: 'Variateur de fréquence 2.2kW',
    slug: 'variateur-frequence-2-2kw',
    sku: 'VAR-VFD-2200',
    shortDescription: 'Variateur de fréquence monophasé/triphasé 2.2kW, 0-400Hz',
    priceHT: 22500,
    category: 'variateurs',
    weight: 3.5,
    specs: [
      { label: 'Puissance', value: '2.2', unit: 'kW', group: 'Électrique' },
      { label: 'Fréquence sortie', value: '0-400', unit: 'Hz', group: 'Contrôle' },
      { label: 'Entrée', value: '220V mono / 380V tri', unit: '', group: 'Électrique' },
    ],
  },
  {
    name: 'Variateur de fréquence 5.5kW',
    slug: 'variateur-frequence-5-5kw',
    sku: 'VAR-VFD-5500',
    shortDescription: 'Variateur de fréquence triphasé 5.5kW avec panneau de contrôle déporté',
    priceHT: 48000,
    category: 'variateurs',
    weight: 6.8,
    specs: [
      { label: 'Puissance', value: '5.5', unit: 'kW', group: 'Électrique' },
      { label: 'Fréquence sortie', value: '0-400', unit: 'Hz', group: 'Contrôle' },
    ],
  },
  {
    name: 'Contrôleur servo AC 1kW',
    slug: 'controleur-servo-ac-1kw',
    sku: 'VAR-SRV-1000',
    shortDescription: 'Servo-drive AC 1kW avec retour encodeur, boucle fermée',
    priceHT: 56000,
    category: 'variateurs',
    weight: 2.1,
    specs: [
      { label: 'Puissance', value: '1', unit: 'kW', group: 'Électrique' },
      { label: 'Type', value: 'Servo AC boucle fermée', unit: '', group: 'Contrôle' },
    ],
  },
  {
    name: 'Disjoncteur modulaire 3P 32A',
    slug: 'disjoncteur-modulaire-3p-32a',
    sku: 'DIS-MOD-3P32',
    shortDescription: 'Disjoncteur modulaire tripolaire 32A courbe C, pouvoir de coupure 6kA',
    priceHT: 2450,
    category: 'disjoncteurs',
    weight: 0.35,
    specs: [
      { label: 'Pôles', value: '3', unit: '', group: 'Caractéristiques' },
      { label: 'Courant nominal', value: '32', unit: 'A', group: 'Électrique' },
      { label: 'Courbe', value: 'C', unit: '', group: 'Caractéristiques' },
      { label: 'Pouvoir de coupure', value: '6', unit: 'kA', group: 'Protection' },
    ],
  },
  {
    name: 'Disjoncteur modulaire 3P 63A',
    slug: 'disjoncteur-modulaire-3p-63a',
    sku: 'DIS-MOD-3P63',
    shortDescription: 'Disjoncteur modulaire tripolaire 63A courbe C, pouvoir de coupure 10kA',
    priceHT: 4200,
    category: 'disjoncteurs',
    weight: 0.45,
    specs: [
      { label: 'Pôles', value: '3', unit: '', group: 'Caractéristiques' },
      { label: 'Courant nominal', value: '63', unit: 'A', group: 'Électrique' },
      { label: 'Pouvoir de coupure', value: '10', unit: 'kA', group: 'Protection' },
    ],
  },
  {
    name: 'Disjoncteur boîtier moulé 3P 250A',
    slug: 'disjoncteur-boitier-moule-3p-250a',
    sku: 'DIS-MCCB-3P250',
    shortDescription: 'Disjoncteur en boîtier moulé MCCB 250A tripolaire, 36kA',
    priceHT: 18500,
    category: 'disjoncteurs',
    weight: 3.2,
    specs: [
      { label: 'Pôles', value: '3', unit: '', group: 'Caractéristiques' },
      { label: 'Courant nominal', value: '250', unit: 'A', group: 'Électrique' },
      { label: 'Pouvoir de coupure', value: '36', unit: 'kA', group: 'Protection' },
    ],
  },
  {
    name: 'Armoire électrique murale 600x400x200',
    slug: 'armoire-electrique-murale-600x400x200',
    sku: 'ARM-MUR-604020',
    shortDescription: 'Coffret métallique IP65 mural 600x400x200mm avec platine de montage',
    priceHT: 8900,
    category: 'armoires',
    weight: 8.5,
    specs: [
      { label: 'Dimensions', value: '600x400x200', unit: 'mm', group: 'Dimensions' },
      { label: 'IP', value: '65', unit: '', group: 'Protection' },
      { label: 'Matériau', value: 'Acier peint RAL 7035', unit: '', group: 'Construction' },
    ],
  },
  {
    name: 'Armoire électrique sur pied 1800x800x400',
    slug: 'armoire-electrique-sur-pied-1800x800x400',
    sku: 'ARM-PIE-180804',
    shortDescription: 'Armoire de distribution autoportante IP55, double porte, 1800x800x400mm',
    priceHT: 45000,
    category: 'armoires',
    weight: 65,
    specs: [
      { label: 'Dimensions', value: '1800x800x400', unit: 'mm', group: 'Dimensions' },
      { label: 'IP', value: '55', unit: '', group: 'Protection' },
      { label: 'Type', value: 'Autoportante double porte', unit: '', group: 'Construction' },
    ],
  },
]

async function seed() {
  console.log('Seeding database...')

  const payload = await getPayload({ config })

  // Create admin user if none exists
  const existingUsers = await payload.find({ collection: 'users', limit: 1 })
  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: 'admin@popelec.fr',
        password: 'REDACTED_PASSWORD',
        firstName: 'Admin',
        lastName: 'Popelec',
        role: UserRoles.Admin,
      },
    })
    console.log('Created admin user: admin@popelec.fr / REDACTED_PASSWORD')
  }

  // Create categories
  const categoryMap = new Map<string, number>()
  for (const cat of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      categoryMap.set(cat.slug, existing.docs[0].id)
      console.log(`Category "${cat.name}" already exists, skipping`)
      continue
    }

    const created = await payload.create({
      collection: 'categories',
      data: {
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
      },
      locale: 'fr',
    })

    // Set English name
    await payload.update({
      collection: 'categories',
      id: created.id,
      data: { name: cat.nameEn },
      locale: 'en',
    })

    categoryMap.set(cat.slug, created.id)
    console.log(`Created category: ${cat.name}`)
  }

  // Create products
  for (const prod of PRODUCTS) {
    const existing = await payload.find({
      collection: 'products',
      where: { sku: { equals: prod.sku } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`Product "${prod.sku}" already exists, skipping`)
      continue
    }

    const categoryId = categoryMap.get(prod.category)
    if (!categoryId) {
      console.warn(`Category "${prod.category}" not found for product "${prod.sku}", skipping`)
      continue
    }

    await payload.create({
      collection: 'products',
      data: {
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        shortDescription: prod.shortDescription,
        status: ProductStatuses.Published,
        pricing: {
          priceHT: prod.priceHT,
          tvaRate: TVARates.Standard,
        },
        stock: {
          quantity: Math.floor(Math.random() * 50) + 5,
          trackStock: true,
          lowStockThreshold: 5,
        },
        physical: {
          weight: prod.weight,
        },
        categories: [categoryId],
        specs: prod.specs,
      },
    })
    console.log(`Created product: ${prod.sku} - ${prod.name}`)
  }

  console.log('\nSeed complete!')
  console.log(`  Categories: ${CATEGORIES.length}`)
  console.log(`  Products: ${PRODUCTS.length}`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
