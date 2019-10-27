import { Query } from 'node-knex-query-executor'
import { Schema_Article } from 'api/src/schema/schema-article'

export const updateArticleQuery: Query<
    { id: string; updates: Partial<Omit<Schema_Article, 'id'>> },
    void,
    'article',
    {}
> = async ({ tables }, args) => {
    await tables
        .article()
        .update(args.updates)
        .where('id', args.id)
}
