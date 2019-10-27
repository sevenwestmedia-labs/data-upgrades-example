import { MockQueryExecutor, Query } from 'node-knex-query-executor'
import { Schema_Shape, DataUpgrade } from './types'
import { noopLogger } from 'typescript-log'
import { createDataUpgrader } from './data-upgrader'

interface TestSchema extends Schema_Shape {
    id: string
    data: number
}

describe('Data upgrade process', () => {
    it('runs upgrades', async () => {
        let updateResult: TestSchema = { id: 'test', applied_upgrades: [], data: 1 }

        const mockQueryExecutor = new MockQueryExecutor()
        mockQueryExecutor
            .mock(getTestWithoutUpgradesApplied)
            .match(({ upgradeName }) =>
                updateResult.applied_upgrades && updateResult.applied_upgrades.includes(upgradeName)
                    ? []
                    : [updateResult],
            )

        mockQueryExecutor.mock(upgradeTestQuery).match(args => {
            updateResult = { ...updateResult, ...args.updates }
        })

        const upgrader = createDataUpgrader(['Test'], {
            upgradesToRun: {
                Test: [doubleDataUpgrade, pointlessUpgrade],
            },
            upgradesToCleanup: { Test: [] },
            services: {
                Test: {
                    getWithUpgradesApplied: getTestWithUpgradesApplied,
                    getWithoutUpgradesApplied: getTestWithoutUpgradesApplied,
                    updateQuery: upgradeTestQuery,
                },
            },
        })

        await upgrader.run(() => mockQueryExecutor, noopLogger(), {})

        expect(updateResult).toBeDefined()
        expect(updateResult.id).toBe('test')
        expect(updateResult.applied_upgrades).toEqual([
            doubleDataUpgrade.upgradeName,
            pointlessUpgrade.upgradeName, // pointless upgrade was added even though it did nothing
        ])
        expect(updateResult.data).toEqual(2)
    })

    it('runs async upgrades', async () => {
        let updateResult: TestSchema = { id: 'test', applied_upgrades: [], data: 1 }

        const mockQueryExecutor = new MockQueryExecutor()
        mockQueryExecutor
            .mock(getTestWithoutUpgradesApplied)
            .match(({ upgradeName }) =>
                updateResult.applied_upgrades && updateResult.applied_upgrades.includes(upgradeName)
                    ? []
                    : [updateResult],
            )

        mockQueryExecutor.mock(upgradeTestQuery).match(args => {
            updateResult = { ...updateResult, ...args.updates }
        })

        const upgrader = createDataUpgrader(['Test'], {
            upgradesToRun: {
                Test: [asyncDoubleDataUpgrade],
            },
            upgradesToCleanup: { Test: [] },
            services: {
                Test: {
                    getWithUpgradesApplied: getTestWithUpgradesApplied,
                    getWithoutUpgradesApplied: getTestWithoutUpgradesApplied,
                    updateQuery: upgradeTestQuery,
                },
            },
        })

        await upgrader.run(() => mockQueryExecutor, noopLogger(), {})

        expect(updateResult).toBeDefined()
        expect(updateResult!.id).toBe('test')
        expect(updateResult!.applied_upgrades).toEqual([asyncDoubleDataUpgrade.upgradeName])
        expect(updateResult!.data).toEqual(2)
    })

    it('runs cleanups', async () => {
        let updateResult: UpdateArgs | undefined
        const mockQueryExecutor = new MockQueryExecutor()
        mockQueryExecutor
            .mock(getTestWithUpgradesApplied)
            .match(() =>
                updateResult ? [] : [{ id: 'test', applied_upgrades: [doubleDataUpgrade.upgradeName], data: 2 }],
            )
        mockQueryExecutor.mock(upgradeTestQuery).match(args => {
            updateResult = args
        })

        const upgrader = createDataUpgrader(['Test'], {
            upgradesToRun: {
                Test: [],
            },
            upgradesToCleanup: { Test: [doubleDataUpgrade.upgradeName] },
            services: {
                Test: {
                    getWithUpgradesApplied: getTestWithUpgradesApplied,
                    getWithoutUpgradesApplied: getTestWithoutUpgradesApplied,
                    updateQuery: upgradeTestQuery,
                },
            },
        })

        await upgrader.run(() => mockQueryExecutor, noopLogger(), {})

        expect(updateResult).toBeDefined()
        expect(updateResult!.id).toBe('test')
        expect(updateResult!.updates.applied_upgrades).toEqual([])
    })
})

const doubleDataUpgrade: DataUpgrade<TestSchema, 'Test'> = {
    upgradeName: 'first-upgrade',
    upgrade(test) {
        return {
            data: test.data * 2,
        }
    },
}

const asyncDoubleDataUpgrade: DataUpgrade<TestSchema, 'Test'> = {
    upgradeName: 'second-upgrade',
    async asyncUpgrade(test) {
        await new Promise(resolve => setTimeout(resolve, 10))

        return {
            data: test.data * 2,
        }
    },
}

const pointlessUpgrade: DataUpgrade<TestSchema, 'Test'> = {
    upgradeName: 'pointless-upgrade',
    upgrade() {
        return undefined
    },
}

const getTestWithUpgradesApplied: Query<
    { upgradeName: string; limit?: number },
    TestSchema[],
    'Test',
    {}
> = async () => {
    return []
}

const getTestWithoutUpgradesApplied: Query<
    { upgradeName: string; limit?: number },
    TestSchema[],
    'Test',
    {}
> = async () => {
    return []
}

interface UpdateArgs {
    id: string
    updates: Partial<TestSchema>
}
const upgradeTestQuery: Query<UpdateArgs, void, 'Test', {}> = async () => {}
