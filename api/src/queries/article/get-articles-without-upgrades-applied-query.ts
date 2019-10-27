import { Query } from 'node-knex-query-executor'

import { Schema_Article } from 'api/src/schema/schema-article'

export const getArticlesWithoutUpgradeApplied: Query<
    { upgradeName: string; limit?: number },
    Schema_Article[],
    'article',
    {}
> = async ({ tables }, args) => {
    return await tables
        .article()
        .whereRaw(`applied_upgrades IS NULL OR NOT ('${args.upgradeName}' = ANY(applied_upgrades))`)
        .limit(args.limit || 100)
}
