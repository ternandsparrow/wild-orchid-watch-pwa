// To (properly) support Safari <10.1, we need a shim:
// https://dexie.org/docs/IndexedDB-on-Safari
import Dexie from 'dexie'
import { wowWarnHandler } from '@/misc/helpers'

const db = new Dexie('WowDb')

db.version(1).stores({
  obsIndividual: '++id, isUploaded',
})

db.version(2).stores({
  obs: '++id, updatedAt',
})

export default db

// will kill our app DB and SW cache (and anything else)
export async function deleteAllDatabases() {
  const dbs = await indexedDB.databases()
  for (const { name } of dbs) {
    try {
      const d = new Dexie(name)
      d.close()
      d.delete()
      console.debug(`Successfully deleted the '${name}' database`)
    } catch (err) {
      const msg = `Failed to delete the '${name}' database`
      wowWarnHandler(msg, err)
    }
  }
}
