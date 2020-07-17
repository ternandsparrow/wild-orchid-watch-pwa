// This script, when run in your browser, will setup IndexedDB so we can check
// if our 2020Jul migration works as expected.
//
// The scenarios we're creating are:
//   - UUID=111-AAA: (old) obs create waiting for core obs req, deps bundle present
//   - UUID=222-BBB: (old) obs req done, deps reqs are pending, no bundle
//   - UUID=333-CCC: (old) obs update waiting for core obs req, deps bundle present
//   - UUID=444-DDD: (new) obs record present, waiting for photos to upload

;(function runTest() {
  connect('workbox-background-sync', 3, 'requests', async objectStore => {
    // gotta be idempotent; clear any old stuff
    await deleteWorkboxReqsIfExists(
      [99901, 99902, 99903, 99904, 99905, 99906, 99907],
      objectStore,
    )

    // these requests are "old" and should be handled in the migration
    console.log('[workbox-background-sync] adding pending observation request')
    await add(objectStore, {
      id: 99901,
      metadata: {
        obsUuid: '111-AAA',
      },
      queueName: 'obs-queue',
      requestData: {},
      timestamp: Date.now(),
    })

    console.log('[workbox-background-sync] adding pending photo request')
    await add(objectStore, {
      id: 99902,
      metadata: {
        obsUuid: '222-BBB',
      },
      queueName: 'obs-dependant-queue',
      requestData: {},
      timestamp: Date.now(),
    })

    console.log('[workbox-background-sync] adding pending obs field request')
    await add(objectStore, {
      id: 99903,
      metadata: {
        obsUuid: '222-BBB',
      },
      queueName: 'obs-dependant-queue',
      requestData: {},
      timestamp: Date.now(),
    })

    console.log('[workbox-background-sync] adding pending obs field request')
    await add(objectStore, {
      id: 99904,
      metadata: {
        obsUuid: '222-BBB',
      },
      queueName: 'obs-dependant-queue',
      requestData: {},
      timestamp: Date.now(),
    })

    console.log('[workbox-background-sync] adding pending observation request')
    await add(objectStore, {
      id: 99905,
      metadata: {
        obsUuid: '333-CCC',
      },
      queueName: 'obs-queue',
      requestData: {},
      timestamp: Date.now(),
    })

    // these requests are "new" and should be left untouched
    console.log('[workbox-background-sync] adding pending photo request')
    await add(objectStore, {
      id: 99906,
      metadata: {
        obsUuid: '444-DDD',
      },
      queueName: 'wow-queue-2', // not using 'wow-queue' otherwise reqs get processed
      requestData: {},
      timestamp: Date.now(),
    })

    console.log('[workbox-background-sync] adding pending photo request')
    await add(objectStore, {
      id: 99907,
      metadata: {
        obsUuid: '444-DDD',
      },
      queueName: 'wow-queue-2', // not using 'wow-queue' otherwise reqs get processed
      requestData: {},
      timestamp: Date.now(),
    })
  })

  connect('wow-sw', 2, 'keyvaluepairs', async objectStore => {
    // gotta be idempotent; clear any old stuff
    await deleteBundlesIfExists(
      ['create:111-AAA', 'update:333-CCC', '444-DDD'],
      objectStore,
    )

    console.log('[wow-sw] adding pending deps bundle for 111-AAA')
    await add(
      objectStore,
      {
        obsUuid: '111-AAA',
      },
      'create:111-AAA',
    )

    console.log('[wow-sw] adding pending deps bundle for 333-CCC')
    await add(
      objectStore,
      {
        obsUuid: '333-CCC',
      },
      'update:333-CCC',
    )

    console.log('[wow-sw] adding pending obs record 444-DDD')
    await add(
      objectStore,
      {
        obsUuid: '444-DDD',
      },
      '444-DDD',
    )
  })

  connect('wow-obs', 2, 'keyvaluepairs', async objectStore => {
    // gotta be idempotent; clear any old stuff
    await deleteObsIfExists(
      ['111-AAA', '222-BBB', '333-CCC', '444-DDD'],
      objectStore,
    )

    console.log('[wow-obs] adding observation 111-AAA')
    await add(
      objectStore,
      {
        uuid: '111-AAA',
        wowMeta: {
          recordType: 'new',
          recordProcessingOutcome: 'withServiceWorker',
        },
      },
      '111-AAA',
    )

    console.log('[wow-obs] adding observation 222-BBB')
    await add(
      objectStore,
      {
        uuid: '222-BBB',
        wowMeta: {
          recordType: 'new',
          recordProcessingOutcome: 'withServiceWorker',
        },
      },
      '222-BBB',
    )

    console.log('[wow-obs] adding observation 333-CCC')
    await add(
      objectStore,
      {
        uuid: '333-CCC',
        wowMeta: {
          recordType: 'edit',
          recordProcessingOutcome: 'withServiceWorker',
        },
      },
      '333-CCC',
    )

    console.log('[wow-obs] adding observation 444-DDD')
    await add(
      objectStore,
      {
        uuid: '444-DDD',
        wowMeta: {
          recordType: 'new',
          recordProcessingOutcome: 'withServiceWorker',
        },
      },
      '444-DDD',
    )
  })
})()

function connect(dbName, dbVersion, objectStoreName, callback) {
  console.log(`Populating ${dbName} DB`)
  const connection = indexedDB.open(dbName, dbVersion)
  connection.onsuccess = e => {
    const db = e.target.result
    try {
      const transaction = db.transaction([objectStoreName], 'readwrite')
      const objectStore = transaction.objectStore([objectStoreName])
      callback(objectStore)
        .catch(err =>
          console.error('Error while dealing with DB=' + dbName, err),
        )
        .finally(() => {
          console.log(`[${dbName}] closing DB`)
          db.close()
        })
    } catch (err) {
      console.error(
        `Failed to open ${dbName}:${dbVersion}. It must exist before we can populate it!`,
      )
    }
  }
  connection.onerror = err => {
    console.error('Failed to connect to DB ' + dbName, err)
  }
}

async function add(objectStore, record, key) {
  try {
    return await new Promise((resolve, reject) => {
      const addRequest = objectStore.add(record, key)
      addRequest.onsuccess = resolve
      addRequest.onerror = reject
    })
  } catch (err) {
    console.warn(
      `Failed while trying to add record with key=${key} and value=${JSON.stringify(
        record,
      )}, cause=${err.target.error}`,
    )
    throw err
  }
}

function deleteWorkboxReqsIfExists(ids, objectStore) {
  return doCursor(
    objectStore,
    cursor => ids.includes(cursor.value.id),
    'workbox requests',
  )
}

function deleteBundlesIfExists(uuids, objectStore) {
  return doCursor(
    objectStore,
    cursor => uuids.includes(cursor.key),
    'deps bundles',
  )
}

function deleteObsIfExists(uuids, objectStore) {
  return doCursor(
    objectStore,
    cursor => uuids.includes(cursor.key),
    'observations',
  )
}

async function doCursor(objectStore, isDeleteCallback, errMsgFragment) {
  try {
    return await new Promise((resolve, reject) => {
      const request = objectStore.openCursor()
      request.addEventListener('success', e => {
        const cursor = e.target.result
        if (!cursor) {
          return resolve()
        }
        if (!isDeleteCallback(cursor)) {
          cursor.continue()
          return
        }
        const delReq = cursor.delete()
        delReq.onsuccess = () => {
          console.log('delete success for a ' + errMsgFragment)
          cursor.continue()
        }
        delReq.onerror = err => {
          return reject({
            msg: `Failed to delete a ${errMsgFragment} record=${JSON.stringify(
              cursor.value,
            )}`,
            err,
          })
        }
      })
      request.addEventListener('error', reject)
    })
  } catch (err) {
    console.warn('Failed while doing pre-run cleanup of ' + errMsgFragment)
    throw err
  }
}
