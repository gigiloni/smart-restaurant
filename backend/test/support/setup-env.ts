import { testDatabaseName, testEnv } from './env.js';

// Runs in every integration test file before anything imports AppModule.
// Values already in process.env win over backend/.env, so this is what points
// the application at the test database.
testDatabaseName();
Object.assign(process.env, testEnv);
