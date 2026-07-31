import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Layout, EmptyState } from '../components/Layout'
import {
  eventsForDay,
  formatWeekRange,
  getCalendarEvents,
  getWeekDays,
  getWeekStart,
  isToday,
  shiftWeek,
  type CalendarEvent,
} from '../utils/calendarService'

export default function Calendar() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const events = useLiveQuery(() => getCalendarEvents(weekStart), [weekStart])

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>日历</h1>
          <p className="muted">按周查看笔试、面试安排与网申截止</p>
        </div>
        <div className="calendar-nav">
          <button className="btn ghost" type="button" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
            ← 上周
          </button>
          <button className="btn ghost" type="button" onClick={() => setWeekStart(getWeekStart(new Date()))}>
            本周
          </button>
          <button className="btn ghost" type="button" onClick={() => setWeekStart(shiftWeek(weekStart, 1))}>
            下周 →
          </button>
        </div>
      </div>

      <p className="week-range">{formatWeekRange(weekStart)}</p>

      {!events ? (
        <div>加载中...</div>
      ) : events.length === 0 ? (
        <EmptyState title="本周暂无安排" hint="在公司详情页为笔试/面试设置「安排时间」，或填写截止日期" />
      ) : (
        <div className="calendar-grid">
          {weekDays.map((day) => {
            const dayEvents = eventsForDay(events, day)
            return (
              <div key={day.toISOString()} className={`calendar-day ${isToday(day) ? 'today' : ''}`}>
                <div className="calendar-day-head">
                  <span>{format(day, 'EEE', { locale: zhCN })}</span>
                  <strong>{format(day, 'M/d')}</strong>
                </div>
                <div className="calendar-events">
                  {dayEvents.length === 0 ? (
                    <span className="muted small">无安排</span>
                  ) : (
                    dayEvents.map((event) => <CalendarEventCard key={event.id} event={event} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <section className="panel legend-panel">
        <span className="legend-item stage">笔试 / 面试</span>
        <span className="legend-item deadline">网申截止</span>
      </section>
    </Layout>
  )
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  return (
    <Link to={`/company/${event.companyId}`} className={`calendar-event ${event.type}`}>
      {event.time && <span className="event-time">{event.time}</span>}
      <span className="event-title">{event.title}</span>
      <span className="event-sub">{event.subtitle}</span>
    </Link>
  )
}
