export function demonstrationSource(value: string) {
  return /合成|模拟|演示|虚构|示意|测试|(?:^|[^a-z])(test|demo|synthetic)(?:$|[^a-z])/i.test(value)
}
