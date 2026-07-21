import { useState, type FormEvent } from 'react'
import { useHead } from '../hooks/useHead'
import { trackLead } from '../lib/analytics'
import { BUDGET_RANGES, CONTACT } from '../data/studio'
import styles from './Contact.module.css'

const INFO: Array<[string, string, string?]> = [
  ['EMAIL', CONTACT.email, `mailto:${CONTACT.email}`],
  ['STUDIO', CONTACT.studio],
  ['INSTAGRAM', CONTACT.instagram, CONTACT.instagramUrl],
  ['LINKEDIN', CONTACT.linkedin, CONTACT.linkedinUrl],
]

export function Contact() {
  useHead(
    'Contact',
    'Send a brief, not a form. Three lines: who you are, what you’re making, when you need it by.',
  )
  const [brief, setBrief] = useState({ name: '', org: '', budget: '', scope: '' })
  const [sent, setSent] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    trackLead(brief.budget)
    setSent(true)
  }

  const replyBy = new Date(Date.now() + 2 * 86400000).toDateString().slice(4)

  return (
    <div className={styles.root}>
      <div>
        <div className="t-label" style={{ marginBottom: 8 }}>§ 05 / WRITE TO US</div>
        <h1 className={`t-display ${styles.title}`}>
          Send a <span style={{ color: 'var(--accent)' }}>brief</span>,
          <br />
          not a <span style={{ color: 'var(--dim)' }}>form.</span>
        </h1>
        <p className={`t-serif ${styles.body}`}>
          The fastest way to start a conversation is a three-line email: who you are, what you're making, and when you
          need it by. We read everything and reply within two working days.
        </p>

        <dl className={`t-mono ${styles.info} anim-fade`}>
          {INFO.map(([k, v, href]) => (
            <div key={k} className={styles.infoRow}>
              <dt className={styles.infoKey}>{k}</dt>
              <dd className={styles.infoValue}>
                {href ? (
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                    {v}
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={`${styles.panel} anim-fade`}>
        <div className="t-label" style={{ marginBottom: 20 }}>/ BRIEF INTAKE · v02</div>
        {sent ? (
          <div className={styles.sent}>
            <div className={`t-mono ${styles.sentBadge}`}>● RECEIVED</div>
            <div className={`t-display ${styles.sentTitle}`}>Thank you.</div>
            <div className={styles.sentNote}>We'll read it today and reply by {replyBy}.</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            {(
              [
                ['name', 'Name'],
                ['org', 'Organisation'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className={styles.field}>
                <span className={`t-mono ${styles.fieldLabel}`}>{l.toUpperCase()}</span>
                <input
                  value={brief[k]}
                  onChange={(e) => setBrief({ ...brief, [k]: e.target.value })}
                  className={styles.input}
                  autoComplete={k === 'name' ? 'name' : 'organization'}
                />
              </label>
            ))}
            <fieldset className={styles.field} style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
              <legend className={`t-mono ${styles.fieldLabel}`} style={{ padding: 0 }}>
                BUDGET RANGE
              </legend>
              <div className={styles.chips}>
                {BUDGET_RANGES.map((b) => (
                  <button
                    type="button"
                    key={b}
                    onClick={() => setBrief({ ...brief, budget: b })}
                    className={`t-mono ${styles.chip} ${brief.budget === b ? styles.chipActive : ''}`}
                    aria-pressed={brief.budget === b}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className={styles.field}>
              <span className={`t-mono ${styles.fieldLabel}`}>THE THREE LINES</span>
              <textarea
                value={brief.scope}
                onChange={(e) => setBrief({ ...brief, scope: e.target.value })}
                rows={5}
                placeholder="who you are · what you're making · when you need it"
                className={styles.textarea}
              />
            </label>
            <button type="submit" className={`t-mono ${styles.submit}`}>
              → Send Brief
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
