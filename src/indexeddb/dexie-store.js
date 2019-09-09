// TODO To (properly) support Safari <10.1, we need a shim:
// https://dexie.org/docs/IndexedDB-on-Safari
import Dexie from 'dexie'
import { wowWarnHandler } from '@/misc/helpers'
import { recordProcessingOutcomeFieldName } from '@/misc/constants'

const db = new Dexie('WowDb')

db.version(1).stores({
  obs: `++id, wowMeta.${recordProcessingOutcomeFieldName}`,
})

export default db

// will kill our app DB and, depending on which browser we're in, maybe also
// wipe SW cache and any other DBs, which is also fine.
export async function deleteAllDatabases() {
  const dbs = await Dexie.getDatabaseNames()
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
