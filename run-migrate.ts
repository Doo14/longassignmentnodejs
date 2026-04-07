import { runMigration } from './src/db/migrate';
runMigration().then(() => process.exit(0)).catch(console.error);