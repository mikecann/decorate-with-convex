export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const ret: any = {};
  keys.forEach((key) => {
    ret[key] = obj[key];
  });
  return ret;
}

export function exhaustiveCheck(param: never): never {
  throw new Error(`Exhaustive check failed: ${param}`);
}

export function wait(ms: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

export const iife = <T>(fn: () => T): T => fn();
