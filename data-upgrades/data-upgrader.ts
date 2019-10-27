import { Logger } from 'typescript-log'

import { Schema_Shape, DataUpgrade } from './types'
import { mapObject } from './utils'
import { addAppliedUpgrades, upgradeApplied } from './applied-upgrades-utils'
import { Query, ReadQueryExecutor } from 'node-knex-query-executor'

/**
 * NOTE This file could be pulled out into an OSS project
 * But you can copy/paste into your project for now
 */

const defaultBatchSize = 50
const defaultCleanupBatchSize = 50

type Updates = Partial<Omit<Schema_Shape, 'id'>>

export interface DataUpgradesOptions {
    /** If this function returns false, the data upgrades will sleep for 60s before trying again */
    enabled?: () => boolean
    setTimeoutOverride?: (cb: () => void, timeout: number) => void
    batchSize?: number
    cleanupBatchSize?: number
}

/**
 * Creates a data upgrader server
 *
 * @example
 *
 */
export function createDataUpgrader<TableNames extends string, Services extends object = {}>(
    tableNames: TableNames[],
    options: {
        upgradesToRun: { [tableName in TableNames]: DataUpgrade<any, TableNames, Services>[] }
        upgradesToCleanup: { [tableName in TableNames]: string[] }
        batchSizeOverrides?: { [upgradeName: string]: number }

        services: {
            [tableName in TableNames]: {
                getWithUpgradesApplied: Query<
                    { upgradeName: string; limit?: number },
                    Schema_Shape[],
                    TableNames,
                    Services
                >
                getWithoutUpgradesApplied: Query<
                    { upgradeName: string; limit?: number },
                    Schema_Shape[],
                    TableNames,
                    Services
                >
                updateQuery: Query<{ id: string; updates: Updates }, any, TableNames, Services>
            }
        }
    },
    upgradeOptions: DataUpgradesOptions = {},
): {
    dataUpgradeState: DataUpgraderState<TableNames>
    run: (
        getQueryExecutor: () => ReadQueryExecutor<TableNames, Services>,
        logger: Logger,
        services: Services,
    ) => Promise<void>
} {
    const remainingUpgrades: { [tableName in TableNames]: string[] } = {
        ...mapObject(options.upgradesToRun, (upgrades: DataUpgrade<any, TableNames, Services>[]) =>
            upgrades.map(upgrade => upgrade.upgradeName),
        ),
    }
    const remainingCleanups: { [tableName in TableNames]: string[] } = {
        ...options.upgradesToCleanup,
    }

    const dataUpgradeState: DataUpgraderState<TableNames> = {
        currentlyRunningUpgrade: {},
        completedUpgrades: mapObject(remainingCleanups, () => []),
        doneCleanups: mapObject(remainingCleanups, () => []),
        remainingUpgrades,
        remainingCleanups: {
            ...options.upgradesToCleanup,
        },
    }

    return {
        dataUpgradeState,
        async run(getQueryExecutor, logger, services) {
            for (const tableName of tableNames) {
                await runDataUpgradesForTable(
                    tableName,
                    options.upgradesToRun[tableName],
                    dataUpgradeState,
                    options.batchSizeOverrides || {},
                    getQueryExecutor,
                    logger,
                    services,
                    options.services[tableName].getWithoutUpgradesApplied,
                    options.services[tableName].updateQuery,
                    {
                        batchSize: upgradeOptions.batchSize || defaultBatchSize,
                        enabled: upgradeOptions.enabled,
                        setTimeoutOverride: upgradeOptions.setTimeoutOverride,
                    },
                )
            }

            for (const tableName of tableNames) {
                await runDataCleanupsForTable(
                    tableName,
                    options.upgradesToCleanup[tableName],
                    dataUpgradeState,
                    getQueryExecutor,
                    logger,
                    options.services[tableName].getWithUpgradesApplied,
                    options.services[tableName].updateQuery,
                    {
                        batchSize: upgradeOptions.cleanupBatchSize || defaultCleanupBatchSize,
                        enabled: upgradeOptions.enabled,
                        setTimeoutOverride: upgradeOptions.setTimeoutOverride,
                    },
                )
            }
        },
    }
}

interface DataUpgraderState<TableNames extends string> {
    currentlyRunningUpgrade: {
        type?: 'upgrade' | 'cleanup' | 'done' | 'paused'
        tableName?: TableNames
        upgradeName?: string
    }
    completedUpgrades: { [tableName in TableNames]: string[] }
    doneCleanups: { [tableName in TableNames]: string[] }
    remainingUpgrades: { [tableName in TableNames]: string[] }
    remainingCleanups: { [tableName in TableNames]: string[] }
}

/**
 * Performs the data upgrades for a single table
 */
async function runDataUpgradesForTable<
    TableNames extends string,
    Schema extends Schema_Shape,
    UpgradeServices extends object = {}
>(
    tableName: TableNames,
    upgradesToRun: DataUpgrade<Schema, TableNames, UpgradeServices>[],
    dataUpgraderState: DataUpgraderState<TableNames>,
    batchSizeOverrides: { [name: string]: number },
    getQueryExecutor: () => ReadQueryExecutor<TableNames, UpgradeServices>,
    logger: Logger,
    upgradeServices: UpgradeServices,
    getWithoutUpgradesApplied: Query<{ upgradeName: string; limit?: number }, Schema[], TableNames, UpgradeServices>,
    updateQuery: Query<{ id: string; updates: Updates }, any, TableNames, UpgradeServices>,
    options: {
        /** If this function returns false, the data upgrades will sleep for 60s before trying again */
        enabled?: () => boolean
        setTimeoutOverride?: (cb: () => void, timeout: number) => void
        batchSize: number
    },
) {
    // First apply upgrades which need applying
    for (const upgrade of upgradesToRun) {
        let ranUpgrades = true
        const upgradeName = upgrade.upgradeName
        logger.info({ tableName, upgrade: upgradeName }, 'Performing upgrade')

        try {
            let timeoutDuration = 10000
            do {
                const start = new Date()

                const shouldRunDataUpgrades = !options.enabled || options.enabled()

                if (!shouldRunDataUpgrades) {
                    logger.debug({ tableName }, 'Skipping data upgrades due to run-data-upgrades toggle')
                    dataUpgraderState.currentlyRunningUpgrade.type = 'paused'
                    dataUpgraderState.currentlyRunningUpgrade.tableName = undefined
                    dataUpgraderState.currentlyRunningUpgrade.upgradeName = undefined
                } else {
                    if (
                        dataUpgraderState.currentlyRunningUpgrade.tableName !== tableName ||
                        dataUpgraderState.currentlyRunningUpgrade.upgradeName !== upgradeName
                    ) {
                        logger.info({ tableName, upgradeName }, 'Starting data upgrade')
                    }
                    dataUpgraderState.currentlyRunningUpgrade.type = 'upgrade'
                    dataUpgraderState.currentlyRunningUpgrade.tableName = tableName
                    dataUpgraderState.currentlyRunningUpgrade.upgradeName = upgradeName

                    logger.debug({ tableName, upgradeName }, 'Performing data upgrade batch')

                    ranUpgrades = false
                    const queryExecutor = getQueryExecutor()

                    const batchToUpgrade = await queryExecutor.execute(getWithoutUpgradesApplied, {
                        upgradeName,
                        limit: batchSizeOverrides[upgradeName] || options.batchSize,
                    })
                    let numberOfErrors = 0
                    for (const schema of batchToUpgrade) {
                        try {
                            await queryExecutor.unitOfWork(async transaction => {
                                let updates: Updates = {}

                                if (upgrade.upgrade) {
                                    updates = { ...upgrade.upgrade(schema, upgradeServices) }
                                }

                                if (upgrade.asyncUpgrade && !upgradeApplied(schema, upgrade.upgradeName)) {
                                    const asyncUpdates = await upgrade.asyncUpgrade(
                                        { ...schema, ...updates },
                                        transaction,
                                        upgradeServices,
                                    )

                                    updates = asyncUpdates ? { ...updates, ...asyncUpdates } : updates
                                }

                                updates.applied_upgrades = addAppliedUpgrades(
                                    schema.applied_upgrades || [],
                                    upgradeName,
                                )

                                ranUpgrades = true

                                await transaction.execute(updateQuery, {
                                    id: schema.id,
                                    updates,
                                })
                            })
                        } catch (error) {
                            numberOfErrors++
                            logger.error({ err: error, tableName, upgradeName, schema }, 'Failed to upgrade item')
                        }
                    }

                    if (numberOfErrors >= batchToUpgrade.length) {
                        if (batchToUpgrade.length) {
                            // This will break the current while loop and move on to the next
                            // data upgrade.
                            logger.info({ tableName, upgradeName }, 'Skipping upgrade')
                            break
                        }
                    }
                }

                const end = new Date()
                timeoutDuration = getTimeoutDuration(start, end, timeoutDuration, shouldRunDataUpgrades, logger)
                await new Promise(resolve => (options.setTimeoutOverride || setTimeout)(resolve, timeoutDuration))
            } while (ranUpgrades)

            if (!dataUpgraderState.completedUpgrades[tableName]) {
                dataUpgraderState.completedUpgrades[tableName] = []
            }
            dataUpgraderState.completedUpgrades[tableName].push(upgradeName)
            dataUpgraderState.remainingUpgrades[tableName] = dataUpgraderState.remainingUpgrades[tableName].filter(
                remainingUpgrade => remainingUpgrade !== upgradeName,
            )
            logger.info({ tableName, upgradeName, dataUpgraderState }, 'Done performing upgrade')
        } catch (err) {
            logger.error({ err, upgrade: tableName, upgradeName }, 'Failed to perform data upgrade')
        }
    }

    logger.info({ tableName }, 'Completed data upgrades')

    dataUpgraderState.currentlyRunningUpgrade.type = 'done'
    dataUpgraderState.currentlyRunningUpgrade.tableName = undefined
    dataUpgraderState.currentlyRunningUpgrade.upgradeName = undefined
}

/**
 * Performs data cleanups for a single table
 */
async function runDataCleanupsForTable<
    TableNames extends string,
    Schema extends Schema_Shape,
    Services extends object = {}
>(
    tableName: TableNames,
    upgradesToCleanup: string[],
    dataUpgraderState: DataUpgraderState<TableNames>,
    getQueryExecutor: () => ReadQueryExecutor<TableNames, Services>,
    logger: Logger,
    getWithUpgradesApplied: Query<{ upgradeName: string; limit?: number }, Schema[], TableNames, Services>,
    updateQuery: Query<{ id: string; updates: Updates }, any, TableNames, Services>,
    options: {
        /** If this function returns false, the data upgrades will sleep for 60s before trying again */
        enabled?: () => boolean
        setTimeoutOverride?: (cb: () => void, timeout: number) => void
        batchSize: number
    },
) {
    // Then cleanup upgrades which are all done
    for (const toCleanup of upgradesToCleanup) {
        dataUpgraderState.currentlyRunningUpgrade.type = 'cleanup'
        dataUpgraderState.currentlyRunningUpgrade.tableName = tableName
        dataUpgraderState.currentlyRunningUpgrade.upgradeName = toCleanup
        let ranUpgrades = false

        let timeoutDuration = 10000
        do {
            const start = new Date()
            const shouldRunDataUpgrades = !options.enabled || options.enabled()

            if (!shouldRunDataUpgrades) {
                logger.debug({ tableName }, 'Skipping data upgrades due to run-data-upgrades toggle')
                dataUpgraderState.currentlyRunningUpgrade.type = 'paused'
                dataUpgraderState.currentlyRunningUpgrade.tableName = undefined
                dataUpgraderState.currentlyRunningUpgrade.upgradeName = undefined

                ranUpgrades = true
            } else {
                ranUpgrades = false

                await getQueryExecutor().unitOfWork(async queryExecutor => {
                    const pubs = await queryExecutor.execute(getWithUpgradesApplied, {
                        upgradeName: toCleanup,
                        limit: options.batchSize,
                    })

                    for (const pub of pubs) {
                        ranUpgrades = true
                        let appliedUpgrades = pub.applied_upgrades || []

                        // Remove all cleanups from this domainItem
                        dataUpgraderState.remainingCleanups[tableName].forEach(upgradeName => {
                            appliedUpgrades = appliedUpgrades.filter(upgrade => upgrade !== upgradeName)
                        })

                        logger.debug({ tableName, id: pub.id, toCleanup }, 'Persisting upgrade cleanup')

                        const updates: Updates = {}
                        updates.applied_upgrades = appliedUpgrades

                        await queryExecutor.execute(updateQuery, {
                            id: pub.id,
                            updates,
                        })
                    }
                })
            }

            const end = new Date()
            timeoutDuration = getTimeoutDuration(start, end, timeoutDuration, shouldRunDataUpgrades, logger)
            await new Promise(resolve => (options.setTimeoutOverride || setTimeout)(resolve, timeoutDuration))
        } while (ranUpgrades)

        if (!dataUpgraderState.doneCleanups[tableName]) {
            dataUpgraderState.doneCleanups[tableName] = []
        }
        dataUpgraderState.doneCleanups[tableName].push(toCleanup)

        dataUpgraderState.remainingCleanups[tableName] = dataUpgraderState.remainingCleanups[tableName].filter(
            remainingCleanup => remainingCleanup !== toCleanup,
        )
        logger.info({ domainType: tableName, cleanup: toCleanup }, 'Done cleaning up upgrade')
    }

    logger.info({ domainType: tableName }, 'Completed data cleanups')

    dataUpgraderState.currentlyRunningUpgrade.type = 'done'
    dataUpgraderState.currentlyRunningUpgrade.tableName = undefined
    dataUpgraderState.currentlyRunningUpgrade.upgradeName = undefined
}

/**
 * Calculates how long to wait before running the next batch
 *
 * Uses the duration of the previous batch and previous timeout
 * to calculate the next timeout (capped at 60 seconds)
 *
 * The idea is that if the database is struggling, the batch time will increase
 * automatically to reduce load.
 * It will then decrease by a maximum of 10% each batch. This is an example graph.
 *
 * Initially the database can't keep up, so then it steps down by 10% twice and finds a
 * nice balance.
 *
 *   .
 *   |\
 *   | .
 *   |  \
 *   |   .......
 * ..|
 */
function getTimeoutDuration(
    start: Date,
    end: Date,
    previousTimeout: number,
    shouldRunDataUpgrades: boolean,
    logger: Logger,
): number {
    const oneMinute = 60000

    if (!shouldRunDataUpgrades) {
        // upgrades disabled by feature toggle
        const timeoutDuration = oneMinute
        logger.debug({ timeoutDuration }, `Not running data upgrades so long sleep`)
        return timeoutDuration
    }

    const duration = end.getTime() - start.getTime()

    // Set timeout to 10 times the time it took to do a single upgrade pass
    const timeoutDuration = duration * 10

    if (timeoutDuration > oneMinute) {
        logger.warn({ timeoutDuration: oneMinute, previousBatchDuration: duration }, `Data upgrade sleep capped to 60s`)
        return oneMinute
    }

    // Enforce a minimum sleep of 1s or the last sleep minus 10%, whichever is larger
    const min = Math.floor(previousTimeout * 0.9)
    const minTimeout = Math.max(1000, min)

    if (timeoutDuration < minTimeout) {
        logger.info({ timeoutDuration: minTimeout }, `Data upgrade sleep raised`)
        return minTimeout
    }

    logger.info({ timeoutDuration }, `Sleep until next data upgrade batch`)
    return timeoutDuration
}
