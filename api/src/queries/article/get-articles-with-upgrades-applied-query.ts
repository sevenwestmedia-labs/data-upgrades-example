import { Query } from 'node-knex-query-executor'
import { Schema_Article } from 'api/src/schema/schema-article'

export const getArticlesWithUpgradeApplied: Query<
    { upgradeName: string; limit?: number },
    Schema_Article[],
    'article',
    {}
> = async ({ tables }, args) => {
    return await tables
        .article()
        .whereRaw(`('{${args.upgradeName}}' && applied_upgrades)`)
        .limit(args.limit || 100)
}
