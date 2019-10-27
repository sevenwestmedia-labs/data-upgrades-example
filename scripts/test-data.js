const Knex = require('knex')
const faker = require('faker')

const knex = Knex({
    connection: 'pg://root:password@localhost/data_upgrades',
    client: 'pg',
})

;
(async function() {
    const rows = 100

    for (let index = 0; index < rows; index++) {
        const heading = faker.lorem.sentence(5)
        await knex('article').insert({
            slug: faker.helpers.slugify(heading),
            kind: 'article',
            heading,
            topics: [faker.random.word(), faker.random.word()],
            publication_date: faker.date.past(1),
            status: faker.helpers.randomize(['live', 'dead', 'incorrect']),
            applied_upgrades: [],
        })

        console.log('Inserted', heading)
    }

    console.log('Test data inserted')

    process.exit(0)
})()