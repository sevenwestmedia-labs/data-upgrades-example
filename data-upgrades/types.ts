import { UnitOfWorkQueryExecutor } from 'node-knex-query-executor'

export interface Schema_Shape {
    id: string

    /**
     * Tracks data upgrade migrations
     * We have database migrations for schema changes, if we do the data migration inside the schema migrations we
     * lock tables for too long, creating user facing errors.
     * To work around that issue we often do background migrations, this column is a general way to deal with this issue.
     * When a particular upgrade has been applied an item can be added to this list, the background upgrade can then just
     * select a number of items which have not had the upgrade applied, then apply the upgrade using the domain upgrades pattern.
     *
     * Once the migration is complete it can be removed from this column and the migration cleaned up
     */
    applied_upgrades: string[]
}

export interface DataUpgrade<
    Schema_Type extends Schema_Shape,
    TableNames extends string,
    UpgradeServices extends object = {}
> {
    upgradeName: string

    upgrade?(schema: Schema_Type, upgradeServices: UpgradeServices): Partial<Schema_Type> | undefined

    /**
     * Async upgrades are only run as part of a transaction manually/through data upgrade process
     **/
    asyncUpgrade?(
        schema: Schema_Type,
        transaction: UnitOfWorkQueryExecutor<TableNames, UpgradeServices>,
        upgradeServices: UpgradeServices,
    ): Promise<Partial<Schema_Type> | undefined>
}
