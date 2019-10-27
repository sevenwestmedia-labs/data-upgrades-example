import { createDataUpgrader } from './data-upgrader'
import { articleDataUpgrades, articleDataUpgradeCleanups } from 'api/src/domain/domain-article'
import { getArticlesWithUpgradeApplied } from 'api/src/queries/article/get-articles-with-upgrades-applied-query'
import { getArticlesWithoutUpgradeApplied } from 'api/src/queries/article/get-articles-without-upgrades-applied-query'
import { updateArticleQuery } from 'api/src/queries/article/update-article-query'

/** Your application creates a data upgrader for each of the tables you want to set it up for */
export const dataUpgrader = createDataUpgrader(
    ['article'],
    {
        upgradesToRun: {
            article: articleDataUpgrades,
        },
        upgradesToCleanup: {
            article: articleDataUpgradeCleanups,
        },
        batchSizeOverrides: {},
        services: {
            article: {
                getWithUpgradesApplied: getArticlesWithUpgradeApplied,
                getWithoutUpgradesApplied: getArticlesWithoutUpgradeApplied,
                updateQuery: updateArticleQuery,
            },
        },
    },
    {
        // Small batches for the demo
        batchSize: 5,
        cleanupBatchSize: 5,
    },
)
