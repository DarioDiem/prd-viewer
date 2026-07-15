let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  let event = "SessionStart";
  try {
    const parsed = JSON.parse(input || "{}");
    if (typeof parsed.hook_event_name === "string") event = parsed.hook_event_name;
  } catch {}

  const additionalContext = [
    "For PACS PRD or TRD work, use the pacs-prd MCP server before reading a complete PRD file.",
    "The bundled server discovers pacs.config.json from the active project root; do not require per-project PACS environment variables.",
    "Start with compact search or entity discovery, then request build_agent_packet in standard mode with an explicit preset and max_tokens budget.",
    "Keep include_unresolved false unless blockers, open questions, or decisions are part of the task.",
    "TOON is an opt-in benchmark only, not a compliance or context-ingestion gate."
  ].join(" ");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext }
  }));
});
