// Format a backend Unix timestamp (seconds) as a short English date, e.g. "Nov 14, 10:13 PM".
export const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
}
