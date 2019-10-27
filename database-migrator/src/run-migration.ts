import Knex from 'knex'
import { WebpackMigrationSource } from './migrator/migration-source'

export interface Options {
    knex: Knex
}

export async function migrate({ knex }: Options) {
    try {
        const migrationConfig: Knex.MigratorConfig = {
            // This allows our migrations to be stored in our webpack bundle
            // rather than on the filesystem
            migrationSource: new WebpackMigrationSource(require.context('./scripts', false, /\.ts$/)),
        }

        const current = await knex.migrate.currentVersion(migrationConfig)
        console.info(`Current: ${current}`)
        await knex.migrate.latest(migrationConfig)
        const nextCurrent = await knex.migrate.currentVersion(migrationConfig)
        console.info(`Completed migrations upto: ${nextCurrent}`)
    } catch (ex) {
        console.log({ err: ex }, `Failed run database migrations`)
        throw ex
    }
}
