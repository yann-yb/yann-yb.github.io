import { useEffect, useState } from 'react'

export function Clock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return <section className="card tile-s clock-card">
    <div className="world-clocks">
      {[
        { label: 'PDT', timeZone: 'Etc/GMT+7' },
        { label: 'EST', timeZone: 'Etc/GMT+5' },
        { label: 'UTC', timeZone: 'UTC' },
        { label: 'CST', timeZone: 'Asia/Shanghai' },
      ].map(({ label, timeZone }) => <div className="world-clock" key={label}>
        <span className="world-clock-label">{label}</span>
        <AnalogClock now={now} timeZone={timeZone} label={label} />
        <div className="world-clock-date">{now ? now.toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' }) : '—'} · {now ? now.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', hour12: true }).split(' ').at(-1) : '—'}</div>
      </div>)}
    </div>
  </section>
}

function AnalogClock({ now, timeZone, label }: { now: Date | null; timeZone: string; label: string }) {
  const parts = now ? new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now) : []
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value || 0)
  const seconds = value('second')
  const minutes = value('minute') + seconds / 60
  const hours = value('hour') % 12 + minutes / 60
  const description = now ? now.toLocaleTimeString('en-US', { timeZone }) : 'Loading'
  return <svg className="analog-clock" viewBox="0 0 100 100" role="img" aria-label={`${label}${label === 'CST' ? ' (China Standard Time)' : ''}: ${description}`}>
    <circle className="clock-face" cx="50" cy="50" r="47" />
    {Array.from({ length: 12 }, (_, index) => <line className="clock-tick" key={index} x1="50" y1="8" x2="50" y2={index % 3 === 0 ? 15 : 11} transform={`rotate(${index * 30} 50 50)`} />)}
    {now && <>
      <line className="clock-hand clock-hour-hand" x1="50" y1="50" x2="50" y2="27" transform={`rotate(${hours * 30} 50 50)`} />
      <line className="clock-hand clock-minute-hand" x1="50" y1="50" x2="50" y2="16" transform={`rotate(${minutes * 6} 50 50)`} />
      <line className="clock-second-hand" x1="50" y1="57" x2="50" y2="13" transform={`rotate(${seconds * 6} 50 50)`} />
    </>}
    <circle className="clock-center" cx="50" cy="50" r="3" />
  </svg>
}
