#!/usr/bin/env node
// Pulls the specified taxa record and all its children from iNat, then
// transforms it to the format that we need in the app for species
// autocomplete. See the ARCHITECTURE.md doc for more details.

const fs = require('fs')
const path = require('path')
// 'request' is deprecated but its already a dependency and its better than
// using the Node http library directly
const request = require('request-promise-native')
const { serialise } = require('../src/misc/taxon-s11n.js')

const args = require('yargs')
  .option('force-cache-refresh', {
    alias: 'f',
    type: 'boolean',
    description:
      'Get fresh taxa data from iNat whether we already have a cache or not',
  })
  .option('api-base-url', {
    alias: 'a',
    type: 'string',
    default: 'https://api.inaturalist.org',
  })
  .option('page-size', {
    alias: 's',
    type: 'number',
    default: 500,
  })
  .option('taxon-id', {
    alias: 'i',
    type: 'number',
    default: 47217,
    description: 'ID of the taxon record that is the base of the subtree',
  })
  .option('output-file', {
    alias: 'o',
    type: 'string',
    default: path.normalize(
      path.join(__dirname, '..', 'public', 'wow-taxa-index.json'),
    ),
    description: 'Transformed data output, ready for use in WOW',
  })
  .option('cache-file', {
    alias: 'c',
    type: 'string',
    default: path.join(__dirname, 'inat-taxa-cache.json'),
    description:
      'Location to store the raw pulled taxa data before transforming.',
  })
  .option('lower-threshold', {
    alias: 'l',
    type: 'number',
    default: 1000,
    description:
      'When computing other branches of the taxa tree to explore, what lower ' +
      'threshold on "times seen" should be used',
  })
  .option('australia-inat-place-id', {
    alias: 'p',
    type: 'number',
    default: 6744,
    description:
      'Numeric ID that iNaturalist uses for Australia, or more generally the ' +
      'place ID you want to build a species list for',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .option('server-max-results', {
    alias: 'm',
    type: 'number',
    description: 'Max results the server will give out for any query',
    default: 10000,
  }).argv

const devPageLimit = parseInt(process.env.PAGE_LIMIT || 0) // only for dev

const pullStats = {
  ranks: {},
  ancestorIds: {},
  idsSeen: new Set(),
  idRootsUsed: new Set(),
  ignoredAncestorIds: null,
}

const transformStats = {
  namesSeen: new Set(),
  duplicateNames: {},
}

;(async function main() {
  console.info(`Running with config:
  API base URL: ${args.apiBaseUrl}
  Page size:    ${args.pageSize}
  Taxon ID:     ${args.taxonId}
  Cache file:   ${args.cacheFile}
  Ouput file:   ${args.outputFile}`)
  const isRunPullStage = args.forceCacheRefresh || !(await isCacheExisting())
  if (isRunPullStage) {
    await doPullStage()
  } else {
    console.info('Cache file exists, skipping the pull stage')
  }
  await doTransformStage()
})().catch(err => {
  console.error('Failed during run', err)
  process.exit(1)
})

async function doPullStage() {
  const stageStartMs = Date.now()
  console.info('Running the pull stage')
  console.info('Getting taxa records')
  const taxaRecords = await doTaxaPullStage()
  console.info('Getting species list')
  const speciesListRecords = await doAussieOrchidsSpeciesListPullStage()
  const thePath = args.cacheFile
  debug(
    `Writing ${taxaRecords.length} raw taxa records and ` +
      `${speciesListRecords.length} raw species list records to cache file ` +
      `${thePath}`,
  )
  const data = {
    taxaRecords,
    speciesListRecords,
  }
  fs.writeFileSync(thePath, JSON.stringify(data, null, 2))
}

async function doTaxaPullStage() {
  const stageStartMs = Date.now()
  let allResults = []
  const targetApiEndpoint = `${args.apiBaseUrl}/v1/taxa?per_page=${args.pageSize}`
  debug(`Using taxa API endpoint=${targetApiEndpoint}`)
  const records = await exploreTaxonId(args.taxonId, targetApiEndpoint)
  allResults = allResults.concat(records)
  const extraBranchIds = computeChildBranchesToExplore()
  console.info(
    `Exploring an extra ${extraBranchIds.length} ID roots: ${JSON.stringify(
      extraBranchIds,
    )}`,
  )
  for (const currTaxonId of extraBranchIds) {
    const currResult = await exploreTaxonId(currTaxonId, targetApiEndpoint)
    allResults = allResults.concat(currResult)
    assertNoDupes(allResults)
  }
  debug(
    `All pages for all taxon branches retrieved in ${(Date.now() -
      stageStartMs) /
      1000} seconds`,
  )
  ponderPullStats()
  return allResults
}

async function doAussieOrchidsSpeciesListPullStage() {
  const stageStartMs = Date.now()
  const targetApiEndpoint =
    `${args.apiBaseUrl}/v1/observations/species_counts` +
    `?per_page=${args.pageSize}` +
    `&place_id=${args.australiaInatPlaceId}` +
    `&taxon_id=${args.taxonId}`
  const result = await getAllPages(targetApiEndpoint)
  debug(
    `All pages for species list retrieved in ${(Date.now() - stageStartMs) /
      1000} seconds`,
  )
  return result
}

async function doTransformStage() {
  const startMs = Date.now()
  console.info('Running the transform stage')
  const rawData = readCacheFile()
  const { ancestorIds, speciesRecords } = rawData.speciesListRecords.reduce(
    (accum, currEntry) => {
      const currTaxon = currEntry.taxon
      transformStats.namesSeen.add(currTaxon.name)
      // assuming we won't get dupes here as these didn't come from the naughty
      // taxa endpoint
      ;(currTaxon.ancestor_ids || []).forEach(currAncestor =>
        accum.ancestorIds.add(currAncestor),
      )
      accum.speciesRecords.push(transformSingleRecord(currTaxon))
      return accum
    },
    {
      ancestorIds: new Set(),
      speciesRecords: [],
    },
  )
  const ancestorRecords = []
  const desiredRanks = ['genus']
  rawData.taxaRecords
    .filter(r => {
      const onlyDesiredRanks = desiredRanks.includes(r.rank)
      return onlyDesiredRanks
    })
    .filter(r => {
      const onlyAncestorsOfOurSpeciesList = ancestorIds.has(r.id)
      return onlyAncestorsOfOurSpeciesList
    })
    .filter(r => {
      // observations in the species list might be identified to a level higher
      // than rank=species
      const notRecordsWeAlreadyHave = !transformStats.namesSeen.has(r.name)
      return notRecordsWeAlreadyHave
    })
    .forEach(r => {
      const name = r.name
      if (transformStats.namesSeen.has(name)) {
        // we're checking for duplicates *within* the list of taxaRecords
        console.warn(`[WARNING] Duplicate name found=${name}`)
        transformStats.duplicateNames[name] =
          (transformStats.duplicateNames[name] || 0) + 1
      }
      transformStats.namesSeen.add(name)
      ancestorRecords.push(transformSingleRecord(r))
    })
  const allRecords = [...speciesRecords, ...ancestorRecords]
  const thePath = args.outputFile
  console.info(
    `Writing ${allRecords.length} records to output file at ${thePath}`,
  )
  fs.writeFileSync(thePath, JSON.stringify(allRecords))
  debug(`Transform stage run in ${Date.now() - startMs}ms`)
  ponderTransformStats()
}

function transformSingleRecord(record) {
  return serialise({
    preferredCommonName: record.preferred_common_name,
    name: record.name,
    photoUrl: (record.default_photo || {}).square_url,
  })
}

function debug(msg) {
  if (!args.verbose) {
    return
  }
  console.info(msg)
}

function isCacheExisting() {
  const theFilePath = args.cacheFile
  return new Promise(resolve => {
    fs.access(theFilePath, fs.constants.F_OK, err => {
      if (err) {
        debug(`Cache file=${theFilePath} does NOT exist`)
        return resolve(false)
      }
      debug(`Cache file=${theFilePath} DOES exist`)
      return resolve(true)
    })
  })
}

function ponderPullStats() {
  let resultText = '# Ranks\n'
  resultText = Object.entries(pullStats.ranks)
    .filter(onlyCountGtOne)
    .sort(sortByCountDesc)
    .reduce((accum, [rank, count]) => {
      accum += `${rank}=${count}\n`
      return accum
    }, resultText)
  resultText += '\n\n# Root IDs explored\n'
  for (curr of pullStats.idRootsUsed.keys()) {
    resultText += curr + '\n'
  }
  resultText += '\n\n# Ancestor IDs\n'
  resultText = Object.entries(pullStats.ancestorIds)
    .filter(onlyCountGtOne)
    .sort(sortByCountDesc)
    .reduce((accum, [id, count]) => {
      accum += `${id}=${count}\n`
      return accum
    }, resultText)
  const thePath = path.join(__dirname, 'pull-stats.txt')
  fs.writeFileSync(thePath, resultText)
  debug(`Wrote pull stats file to ${thePath}`)
}

function ponderTransformStats() {
  let resultText = `# ${
    Object.keys(transformStats.duplicateNames).length
  } Duplicate names (should be 0)\n`
  for ([name, count] of Object.entries(transformStats.duplicateNames)) {
    resultText += `${count}  ${name}\n`
  }
  const thePath = path.join(__dirname, 'transform-stats.txt')
  fs.writeFileSync(thePath, resultText)
  debug(`Wrote transform stats file to ${thePath}`)
}

function onlyCountGtOne([thing, count]) {
  return count > 1
}

function sortByCountDesc([_, aCount], [_2, bCount]) {
  if (aCount < bCount) return 1
  if (aCount > bCount) return -1
  return 0
}

async function exploreTaxonId(targetTaxonId, targetApiEndpoint) {
  pullStats.idRootsUsed.add(targetTaxonId)
  console.info(`Exploring branch for taxonId=${targetTaxonId}`)
  const branchStartMs = Date.now()
  const baseUrl = `${targetApiEndpoint}&taxon_id=${targetTaxonId}`
  let result = await getAllPages(baseUrl)
  const countFromServer = result.length
  result = deduplicate(result)
  const countAfterDedupeResultSet = result.length
  result = result.filter(e => !pullStats.idsSeen.has(e.id))
  const countAfterRemovingAlreadySeen = result.length
  console.info(
    `Summary for taxonId=${targetTaxonId}:
    All pages retrieved in ${(Date.now() - branchStartMs) / 1000} seconds
    ${countFromServer} records pulled from server
    ${countFromServer -
      countAfterDedupeResultSet} dropped as duplicates within the result set
    ${countAfterDedupeResultSet -
      countAfterRemovingAlreadySeen} dropped as we've already seen them
    ${countAfterRemovingAlreadySeen} added to collection`,
  )
  updatePullStats(result)
  return result
}

async function getAllPages(baseUrl) {
  let currPage = 1
  let isMore = true
  let result = []
  while (isMore) {
    const pageStartMs = Date.now()
    const currUrl = `${baseUrl}&page=${currPage}`
    const resp = await request(currUrl)
    const bodyObj = JSON.parse(resp)
    result = result.concat(bodyObj.results)
    debug(`Page=${currPage} retrieved in ${Date.now() - pageStartMs}ms`)
    currPage++
    isMore = (() => {
      if (devPageLimit && currPage > devPageLimit) {
        return false
      }
      if (bodyObj.results.length < args.pageSize) {
        return false
      }
      if (result.length >= args.serverMaxResults) {
        console.warn(
          `[WARNING] hit result limit. We expect server won't serve any more ` +
            `results for this query. Results so far=${result.length}, ` +
            `configured server limit=${bodyObj.total_results}`,
        )
        return false
      }
      if (result.length >= bodyObj.total_results) {
        console.warn(
          `[WARNING] triggered loop sanity check with current result ` +
            `length=${result.length} being greater than or equal to ` +
            `total_results=${bodyObj.total_results} in response`,
        )
        return false
      }
      return true
    })()
  }
  return result
}

function updatePullStats(records) {
  const mainRootRecord = records.find(r => r.id === args.taxonId)
  if (mainRootRecord) {
    // this will only fire once and only for the first result set
    pullStats.ignoredAncestorIds = mainRootRecord.ancestor_ids
  }
  // expects we only get passed records we have NOT seen
  records.forEach(r => {
    pullStats.idsSeen.add(r.id)
    plusOne(pullStats.ranks, r.rank)
    for (const curr of r.ancestor_ids) {
      if (pullStats.ignoredAncestorIds.includes(curr)) {
        continue
      }
      plusOne(pullStats.ancestorIds, curr)
    }
  })
  function plusOne(thingy, key) {
    thingy[key] = (thingy[key] || 0) + 1
  }
}

function computeChildBranchesToExplore() {
  // the iNat API caps out at 10k results. You'll get 403'd if you go past
  // that. So if we need an ancestor 10k times, it's absolutely common to every
  // record we have, and therefore not worth exploring (because we already
  // have)
  const ancestorOfEverythingCount = 10000
  const mightBeMoreWeHaventSeenCountThreshold = args.lowerThreshold
  return Object.entries(pullStats.ancestorIds)
    .filter(
      ([_, count]) =>
        count < ancestorOfEverythingCount &&
        count > mightBeMoreWeHaventSeenCountThreshold,
    )
    .map(([id]) => id)
}

function readCacheFile() {
  try {
    return JSON.parse(fs.readFileSync(args.cacheFile))
  } catch (err) {
    throw new Error('Failed to read cache file. ' + err.message)
  }
}

/**
 * Surely the server won't return duplicates as we page through everything for
 * a single query, why would you even think that? Perpare to be surprised.
 */
function deduplicate(records) {
  const dedupeMapping = records.reduce((accum, curr) => {
    accum[curr.id] = curr
    return accum
  }, {})
  const result = Object.values(dedupeMapping)
  const diff = records.length - result.length
  if (diff !== 0) {
    console.debug(`Removed ${diff} duplicates from the result set`)
  }
  return result
}

function assertNoDupes(records) {
  const countOfIds = records.reduce((accum, curr) => {
    accum[curr.id] = (accum[curr.id] || 0) + 1
    return accum
  }, {})
  const dupeIds = Object.entries(countOfIds)
    .filter(([id, count]) => count > 1)
    .map(e => e[0])
  if (dupeIds.length === 0) {
    return
  }
  // Big problem! We have code to prevent this, but it's clearly not working
  console.warn(`[WARNING] Found ${dupeIds.length} duplicate IDs during pull`)
  debugger
}
