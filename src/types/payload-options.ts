/**
 * Convert a value→label record into the Payload CMS select-field options format.
 *
 * @example
 *   enumToPayloadOptions<ProductStatus>({
 *     [ProductStatuses.Draft]: 'Brouillon',
 *     [ProductStatuses.Published]: 'Publié',
 *   })
 */
export function enumToPayloadOptions<V extends string>(
  labels: Record<V, string>,
): Array<{ label: string; value: V }> {
  return (Object.entries(labels) as Array<[V, string]>).map(([value, label]) => ({
    label,
    value,
  }))
}
