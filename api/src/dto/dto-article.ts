export interface DTO_Article {
    id: string
    slug: string
    kind: 'article'
    heading: string
    topics: string[]
    publication_date: Date
}
