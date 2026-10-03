import { Library, ArrowUpRight, Github, Linkedin, BriefcaseBusiness, Smile, Star, Clipboard, CalendarDays, NotebookPen } from 'lucide-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { EmojiArtwork } from '../components/EmojiArtwork'
import { Clock } from '../components/Widgets'
import { ReadingTile } from '../components/ReadingRoom'
import { useAuth } from '../components/AuthProvider'
import { isWidgetVisible, widgets } from '../lib/widgets'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const { isAuthenticated, devPreview } = useAuth()
  const visible = (id: keyof typeof widgets) => isWidgetVisible(id, { authenticated: isAuthenticated || devPreview, development: import.meta.env.DEV })
  return <main className="dashboard">
    <div className="dashboard-grid">
      {visible('profile') && <section className="card tile-s profile-card">
        <div className="profile-heading"><img className="profile-avatar" src="/images/avatar.png" alt="My original puppy avatar" width="64" height="64" /><h1>Yihan Bao</h1><span aria-hidden="true">👋</span></div>
        <p>Software engineer</p>
        <div className="profile-links">
          <a href="https://github.com/yann-yb" aria-label="GitHub" title="GitHub"><Github size={18} aria-hidden="true" /></a>
          <a href="https://www.linkedin.com/in/yihan-bao/" aria-label="LinkedIn" title="LinkedIn"><Linkedin size={18} aria-hidden="true" /></a>
        </div>
      </section>}
      {visible('clocks') && <Clock />}
      {visible('experience') && <Link className="card tile-m experience-card clickable-card" to="/about" aria-label="Experience">
        <div className="card-label">Experience <BriefcaseBusiness size={15} /></div>
        <div className="career-row"><span className="company-logo nvidia">N</span><div><strong>NVIDIA</strong><span>DGXCloud</span></div><span className="career-dates">Mar 2025 – now</span></div>
        <div className="career-row"><span className="company-logo oracle">O</span><div><strong>Oracle Cloud Infrastructure</strong><span>Network dataplane</span></div><span className="career-dates">Nov 2020 – Mar 2025</span></div>
        <div className="career-row"><span className="company-logo amadeus">a</span><div><strong>Amadeus</strong><span>C++ and cloud infra</span></div><span className="career-dates">Jan 2018 – Nov 2020</span></div>
      </Link>}
      {visible('emoji') && <Link className="card tile-s emoji-card clickable-card" to="/emoji" aria-label="Emoji">
        <div className="card-label">Emoji <Smile size={18} /></div>
        <div className="emoji-preview" aria-hidden="true">{['🥲', '🐕', '💤', '🫖', '🚀'].map(glyph => <EmojiArtwork key={glyph} glyph={glyph} />)}</div>
        <div className="muted"><code>:)</code> · <code>:smile:</code></div>
      </Link>}
      {visible('stars') && <section className="card tile-s stars-card">
        <div className="card-label">Stars <Star size={16} /></div>
        <a className="career-row favorite-app" href="https://github.com/Clipy/Clipy">
          <span className="company-logo"><Clipboard size={16} aria-hidden="true" /></span>
          <div><strong>Clipy</strong><span>Clipboard manager</span></div>
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <a className="career-row favorite-app" href="https://www.mowglii.com/itsycal/">
          <span className="company-logo"><CalendarDays size={16} aria-hidden="true" /></span>
          <div><strong>Itsycal</strong><span>Menu bar calendar</span></div>
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </section>}
      {visible('memo') && <Link className="card tile-s memo-card clickable-card" to="/memo" aria-label="Memo">
        <div className="card-label">Memo <NotebookPen size={16} /></div>
        <div className="muted">Linked notes</div>
      </Link>}
      {visible('newsroom') && <ReadingTile />}
      {visible('myshadow') && <a href="/myshadow" className="card tile-s clickable-card" aria-label="MyShadow notes"><div className="card-label">MyShadow <Library size={16} aria-hidden="true" /></div><div className="muted">Notes</div></a>}
    </div>
  </main>
}
