import { db } from './db'
import { normalizeSearch } from './normalize'

export async function addSearchHistory(query: string) {
  const q = query.trim()
  if (q.length < 2) return
  const norm = normalizeSearch(q)
  await db.transaction('rw', db.history, async () => {
    const same = await db.history.filter((h) => normalizeSearch(h.query) === norm).primaryKeys()
    if (same.length) await db.history.bulkDelete(same)
    await db.history.add({ query: q, timestamp: Date.now() })
    const count = await db.history.count()
    if (count > 60) {
      const old = await db.history.orderBy('timestamp').limit(count - 60).primaryKeys()
      await db.history.bulkDelete(old)
    }
  })
}

export async function recordView(articleId: string) {
  await db.views.put({ articleId, viewedAt: Date.now() })
  const count = await db.views.count()
  if (count > 80) {
    const old = await db.views.orderBy('viewedAt').limit(count - 80).primaryKeys()
    await db.views.bulkDelete(old)
  }
}
