import { Query } from 'node-knex-query-executor'
import { Schema_Article } from 'api/src/schema/schema-article'

export const getArticlesQuery: Query<{ limit?: number }, Schema_Article[], 'article', {}> = async (
    { tables },
    args,
) => {
    return await tables
        .article()
        .where('status', 'live')
        .limit(args.limit || 100)
}
