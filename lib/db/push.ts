import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

const pushSchema = async () => {
  console.log('Pushing schema to database...')
  
  const client = postgres(connectionString, { max: 1 })
  const db = drizzle(client, { schema })
  
  try {
    console.log('Database schema pushed successfully!')
  } catch (error) {
    console.error('Error pushing schema:', error)
  } finally {
    await client.end()
  }
}

pushSchema()