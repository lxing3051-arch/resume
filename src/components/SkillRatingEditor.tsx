import type { SkillLevel } from '../types'

const LEVELS: SkillLevel[] = ['会', '需复习', '不会']

const levelClass: Record<SkillLevel, string> = {
  会: 'skill-ok',
  需复习: 'skill-review',
  不会: 'skill-gap',
}

interface Props {
  skills: string[]
  ratings: Record<string, SkillLevel>
  onChange: (ratings: Record<string, SkillLevel>) => void
}

export function SkillRatingEditor({ skills, ratings, onChange }: Props) {
  if (!skills.length) return null

  const known = skills.filter((s) => ratings[s] === '会').length
  const matchRate = Math.round((known / skills.length) * 100)

  return (
    <div className="skill-rating-panel">
      <div className="panel-head">
        <h3>技能匹配度</h3>
        <span className={`match-rate ${matchRate >= 70 ? 'good' : matchRate >= 40 ? 'mid' : 'low'}`}>
          {matchRate}% 掌握
        </span>
      </div>
      <div className="skill-rating-list">
        {skills.map((skill) => (
          <div key={skill} className="skill-rating-row">
            <span>{skill}</span>
            <div className="skill-level-btns">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`skill-level-btn ${levelClass[level]} ${ratings[skill] === level ? 'active' : ''}`}
                  onClick={() => onChange({ ...ratings, [skill]: level })}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkillRatingBadges({
  skills,
  ratings,
}: {
  skills: string[]
  ratings?: Record<string, SkillLevel>
}) {
  if (!skills.length) return null
  return (
    <div className="tags">
      {skills.map((skill) => {
        const level = ratings?.[skill] ?? '需复习'
        return (
          <span key={skill} className={`tag ${levelClass[level]}`}>
            {skill} · {level}
          </span>
        )
      })}
    </div>
  )
}
