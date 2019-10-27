# Data upgrades example

This sample project shows how we have solved upgrading data in our database or refactoring the schema over time. This is implemented with TypeScript, NodeJS and PostgreSQL but the patterns would work really well in the Java, .NET or other spaces.

Because this problem is focused on solving an in production problem we use a similar setup that we use in production.

## Running example

If you just want to run it and check it out

### Setup

Run postgres (if you don't have your own setup, just run):

```
docker run -d --name data_upgrade_postgres -p 5432:5432 postgres
```

To stop, run:

```
docker rm -f data_upgrade_postgres
```

### Running

Run the below scripts, it will build the database migrator, create a database, run the database migrations then put some test data with some errors which need fixing by the data upgrades

```
npm run build:db-migrator
npm run setup:create-db
npm run setup:migrate-db
npm run setup:test-data
```

Now to see it work, run `npm run start`, this will start the API and start running the data upgrades

## The problems

There are 2 main problems this attempts to make far easier.

### 1. Physical breaking changes

Things like changing column data types or renaming columns are breaking changes which need either downtime to your application or multiple deployments with specific code to handle data being in multiple applications

### 2. Bulk updating of data

The other class of changes which only becomes a thing once your database becomes a certain size is fixing data problems like data corruption/encoding issues. Depending on how your database is setup doing a heap of writes at once may impact your read performance and cause an outage (it does for us).

## The solution

There are a few moving parts and [this blog post] explains them in more depth. The tl;dr is:

1. Create 'domain' objects which wrap the raw rows returned from the database
2. Add an applied_upgrades column
3. The constructor of the domain objects apply any upgrades which have not been applied already
4. All inserts should be done as if all upgrades were applied (so when the upgrade is removed, the insert process was not relying on running upgrades)
5. Have a background process which upgrades batches of rows until they are all upgraded

This means that for your application code an un-upgraded row will have all upgrades applied before it can be used, so all upgrades appear to have been run without the risk to production stability.

Since putting this solution in place we have refactored a number of things in our database which were too risky or difficult to change before we had a cross cutting solution to the problem.

## Examples of things we have fixed

### Missing image dimensions against images

We now heavily use image dimensions ahead of images loading, for things like intrinsic placeholders and other things.
We wrote a async data upgrade which used https://www.npmjs.com/package/request-image-size to find the image size and update the missing image metadata from before we were populating that data.

### Un-encoded image urls

We had `+` characters in some image urls, which caused issues when being served from s3. We used a data upgrade to fix the data rather than encoding in our APIs

### Migrating from string to jsonb or text[] columns in PostgreSQL

Changing a columns data type could break code doing inserts, updates or selects. We used a data upgrade to move the data between the old and the new column.

And many many more.

## FAQ

### Why not version the rows?

Versioning database rows is also an option, the issue is that different upgrades apply to different versions and you then need to know when you can remove that version.

The simplicity of this is that all upgrades are named, so after they have run to completion you can just delete them, then the same process which upgrades all rows in the background remove that upgrade from the applied_upgrades column just like it never existed.
