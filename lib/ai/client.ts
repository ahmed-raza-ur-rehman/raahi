import OpenAI from "openai";

const dashScopeBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export function isDashScopeConfigured() {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

export function getDashScopeClient() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  return new OpenAI({
    apiKey,
    baseURL: dashScopeBaseUrl,
    timeout: 15_000,
  });
}
