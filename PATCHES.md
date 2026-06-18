# Targeted Patches for calendar/page.tsx and dashboard/page.tsx
# Apply these manually to your existing files.

## calendar/page.tsx — SessionBlock: add students + room

FIND (in SessionBlock function):
      {height > 28 && (
        <p style={{ fontSize: 10, color: c.text, opacity: 0.75, lineHeight: '1.3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatTime(session.scheduled_at)} · {session.teacher_name}
        </p>
      )}

REPLACE WITH:
      {height > 28 && (
        <p style={{ fontSize: 10, color: c.text, opacity: 0.75, lineHeight: '1.3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatTime(session.scheduled_at)} · {session.teacher_name}
          {session.room_name && ` · ${session.room_name}`}
        </p>
      )}
      {height > 44 && session.students.length > 0 && (
        <p style={{ fontSize: 10, color: c.text, opacity: 0.6, lineHeight: '1.3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {session.students.map(s => s.full_name).join(', ')}
        </p>
      )}

---

## dashboard/page.tsx — timeline session block: add students + room

FIND (in the day timeline session blocks):
                          {h > 30 && (
                            <p style={{ fontSize:10, color:c.text, opacity:0.75, lineHeight:'1.3',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {formatTime(s.scheduled_at)} · {s.teacher_name}
                            </p>
                          )}

REPLACE WITH:
                          {h > 30 && (
                            <p style={{ fontSize:10, color:c.text, opacity:0.75, lineHeight:'1.3',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {formatTime(s.scheduled_at)} · {s.teacher_name}
                              {s.room_name && ` · ${s.room_name}`}
                            </p>
                          )}
                          {h > 48 && s.students.length > 0 && (
                            <p style={{ fontSize:10, color:c.text, opacity:0.6, lineHeight:'1.3',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {s.students.map(st => st.full_name).join(', ')}
                            </p>
                          )}
