// Format a backend Unix timestamp (seconds) as "MM-DD HH:mm" in local time.
export const formatMonthDayTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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
