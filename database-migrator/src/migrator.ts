import Knex from 'knex'
import { migrate } from './run-migration'

export interface CommandLineArgs {
    dbConnectionString: string
}

export async function migrator(config: CommandLineArgs) {
    migrate({
        knex: Knex({
            connection: config.dbConnectionString,
            client: 'pg',
        }),
    })
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
}
