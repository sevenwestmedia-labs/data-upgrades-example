import http from 'http'
import express from 'express'
import { articleRouter } from './routes/articles'
import { dataUpgrader } from 'data-upgrades/data-upgrades'
import { ReadQueryExecutor } from 'node-knex-query-executor'
import { getKnex } from './get-knex'
import { consoleLogger } from 'typescript-log'

const app = express()

app.use(express.json())
app.use(articleRouter)

// Expose a health check route with current upgrade info
app.get('/health-check', (_, res) => {
    res.json({
        uptime: process.uptime(),
        dataUpgrades: dataUpgrader.dataUpgradeState,
    })
})

const server = http.createServer(app)

const logger = consoleLogger('debug')

server.listen(4600, undefined, () => {
    logger.info(`Express is listening to http://localhost:4600`)
    logger.info(`Try hit http://localhost:4600/health-check to see upgrade status`)
})

// Kick off data upgrade process
dataUpgrader.run(() => new ReadQueryExecutor<'article', {}>(getKnex(), {}, { article: 'article' }), logger, {})
