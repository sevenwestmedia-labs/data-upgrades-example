import { Schema_Article } from '../schema/schema-article'
import { DataUpgrade } from 'data-upgrades/types'
import { fixBadStatuses } from './article-data-upgrades/fix-bad-statuses'
import { EffectiveSchema, createEffectiveSchema } from './effective-schema'

export interface ArticleDataUpgrade extends DataUpgrade<Schema_Article, 'article'> {}

/***
 * List of active article upgrades!
 ***/
export const articleDataUpgrades: ArticleDataUpgrade[] = [fixBadStatuses]
export const articleDataUpgradeCleanups: string[] = []

export class Domain_Article {
    private effectiveSchema: EffectiveSchema<Schema_Article, 'article'>

    constructor(protected schema: Schema_Article) {
        this.effectiveSchema = createEffectiveSchema(schema, {})
        this.effectiveSchema.applyUpgrades(...articleDataUpgrades)
    }

    get id(): string {
        return this.effectiveSchema.current.id
    }

    get slug(): string {
        return this.effectiveSchema.current.slug
    }

    get kind(): 'article' {
        return this.effectiveSchema.current.kind
    }

    get heading(): string {
        return this.effectiveSchema.current.heading
    }

    get topics(): string[] {
        return this.effectiveSchema.current.topics
    }

    get publication_date(): Date {
        return this.effectiveSchema.current.publication_date
    }

    get status(): 'live' | 'dead' {
        return this.effectiveSchema.current.status
    }
}
