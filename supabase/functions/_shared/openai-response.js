// Extract only assistant-authored text from the raw Responses API JSON payload.
export function extractAssistantText(response) {
  if (!response || !Array.isArray(response.output)) return "";

  return response.output
    .filter((item) => item?.type === "message" && item?.role === "assistant")
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join(" ")
    .trim();
}
