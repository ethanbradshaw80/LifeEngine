/**
 * Save format, versioning, validation and migrations.
 *
 * PURE by design: this package converts data and performs no I/O. Reading and
 * writing storage is the web app's job, so the engine and its persistence can
 * run unchanged in a Web Worker and, later, on a server.
 */

export {
  LOCAL_USER_ID,
  MIN_SUPPORTED_SCHEMA_VERSION,
  SaveError,
  SCHEMA_VERSION,
} from './schema.js'
export type { SaveFile, SaveHeader, UnknownSave } from './schema.js'

export { canonicalJson, checksumOf, reviveBigInts } from './encoding.js'
export { migrate, readSchemaVersion } from './migrations.js'
export type { MigrationResult } from './migrations.js'
export { fromSaveFile, toSaveFile } from './save.js'
export type { LoadResult } from './save.js'
