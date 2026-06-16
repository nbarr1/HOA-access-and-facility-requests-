export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env.local and fill in the value before running this command.`);
  }
  return value;
}

export function requiredEnvFrom(names: [string, ...string[]]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  const envList = names.join(" or ");
  throw new Error(`Missing required env var ${envList}. Copy .env.example to .env.local and fill in one of these values before running this command.`);
}
