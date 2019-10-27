import { ArticleDataUpgrade } from '../domain-article'

export const fixBadStatuses: ArticleDataUpgrade = {
    upgradeName: 'fix-bad-statuses',
    upgrade: schema => {
        if (schema.status === 'live' || schema.status === 'dead') {
            return
        }

        // If there is an invalid value in the database
        console.log('Fixing bad status', { id: schema.id, old: schema.status, new: 'dead' })

        return {
            status: 'dead',
        }
    },
}
