import Knex from 'knex'
export function getKnex() {
    return Knex({
        connection: process.env.CONNECTION_STRING,
        client: 'pg',
    })
}
