import express from 'express'
import Knex from 'knex'

import { DTO_Article } from '../dto/dto-article'
import { Schema_Article } from '../schema/schema-article'
import { Domain_Article } from '../domain/domain-article'
import { getKnex } from '../get-knex'
import { ReadQueryExecutor } from 'node-knex-query-executor'
import { getArticlesQuery } from '../queries/article/get-articles-query'

export const articleRouter = express.Router()

articleRouter.get('/articles', async (_req, res) => {
    try {
        const queryExecutor = new ReadQueryExecutor(getKnex(), {}, { article: 'article' })

        const articles: Schema_Article[] = await queryExecutor.execute(getArticlesQuery, {})

        // Map your raw schema into a domain article before using it
        // This ensures any data upgrades are applied
        const domainArticles = articles.map(article => new Domain_Article(article))

        // Do not return your domain objects directly, explicitly map back to plain objects to
        // prevent leaking unwanted data
        res.json(
            domainArticles.map<DTO_Article>(article => ({
                id: article.id,
                heading: article.heading,
                kind: article.kind,
                publication_date: article.publication_date,
                slug: article.slug,
                topics: article.topics,
            })),
        )
    } catch (err) {
        console.log('GET /articles failed:', err ? err.message : '')
        res.status(500).send()
    }
})

articleRouter.post('/articles', async (req, res) => {
    try {
        const knex = Knex({
            connection: process.env.CONNECTION_STRING,
            client: 'pg',
        })

        const body = req.body

        const { id } = await knex('article')
            .insert({
                slug: body.slug,
                kind: body.kind,
                heading: body.heading,
                topics: body.topics,
                publicationDate: body.publicationDate,
                status: 'live',
            })
            .returning('id')

        res.status(201).json({ id })
    } catch (err) {
        console.log('POST /articles failed:', err ? err.message : '')
        res.status(500).send()
    }
})
