import { Schema_Shape } from 'data-upgrades/types'

export interface Schema_Article extends Schema_Shape {
    slug: string
    kind: 'article'
    heading: string
    topics: string[]
    publication_date: Date
    status: 'live' | 'dead'
}
