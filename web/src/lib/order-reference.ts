export function formatOrderIdentifier(orderNumber?: string | null) {
  if (!orderNumber) {
    return null;
  }

  return orderNumber.replace(/^ML-/, '');
}

export function formatOrderReference(orderNumber?: string | null, packId?: string | null) {
  if (packId) {
    return packId;
  }

  const formattedOrderNumber = formatOrderIdentifier(orderNumber);
  return formattedOrderNumber ?? 'Venta';
}
