const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "openai_key", pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { name: "anthropic_key", pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { name: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: "github_pat", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: "aws_key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "slack_token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/gi },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    name: "env_assignment",
    pattern:
      /\b([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|\S+)/g,
  },
  { name: "connection_string", pattern: /\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi },
];

export function redactSecrets(input: string): string {
  let output = input;
  for (const { name, pattern } of SECRET_PATTERNS) {
    output = output.replace(pattern, (match, key?: string) => {
      if (name === "env_assignment" && key) return `${key}=[REDACTED]`;
      return "[REDACTED]";
    });
  }
  return output;
}

export function containsSecret(input: string): boolean {
  return SECRET_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(input);
  });
}
