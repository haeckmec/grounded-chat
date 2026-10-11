/**
 * Admin server handlers on Web `Request` and `Response`: config rows with optimistic concurrency,
 * transcripts, retention prune and the red-team tally. Every handler takes the host's `authorize`
 * and refuses without it. Also the config store port, the secret-shaped key check and localized
 * text helpers. Accounts and login stay the host's.
 */
export { createConfigHandlers, createPruneHandler, createStatsHandler, createTranscriptHandler, type Authorize, type ConfigValidator } from './handlers.js';
export { configStoreContractCases, InMemoryConfigStore, type ConfigRow, type ConfigStore, type ConfigStoreContractCase } from './config-store.js';
export { findSecretShapedKeys, SECRET_KEY_PATTERN, type SecretKeyIssue } from './secrets.js';
export { coerceLocalizedList, coerceLocalizedText, type LocalizedList, type LocalizedText } from './localized.js';
