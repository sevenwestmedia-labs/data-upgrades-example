import Knex from 'knex'

// This is one of our initial migrations, so it doesn't have to take into account
// existing data

export async function up(db: Knex) {
    await db.schema
        .alterTable('article', table => {
            table.specificType('applied_upgrades', 'text[]')

            // GIN: Generalized Inverted Index https://www.postgresql.org/docs/9.1/static/textsearch-indexes.html
            table.index(['applied_upgrades'], undefined, 'GIN')
        })
        .then()
}

export async function down() {
    throw new Error('Down migrations not supported')
}
