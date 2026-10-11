/**
 * Key names that look like credentials. Config never holds a secret: keys live in env vars. "token"
 * followed by budget, count, used or limit is a usage setting, not a credential.
 */
export const SECRET_KEY_PATTERN = /secret|hmac|api[_-]?key|password|token(?!budget|count|used|limit)/i;

/** One secret-shaped key found in a config value. */
export interface SecretKeyIssue {
  message: string;
  path: Array<string | number>;
}

/**
 * Every secret-shaped key anywhere in a raw config value. Run it on the raw input, before any schema
 * strips unknown keys: the realistic leak is an extra field such as `apiKey` pasted into a form.
 */
export function findSecretShapedKeys(value: unknown, path: Array<string | number> = []): SecretKeyIssue[] {
  if (!value || typeof value !== 'object') return [];
  const issues: SecretKeyIssue[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      issues.push({ message: `Config key "${key}" looks like a secret and must live in an env var instead, never in config.`, path: [...path, key] });
    }
    issues.push(...findSecretShapedKeys(child, [...path, key]));
  }
  return issues;
}
