const fs = require('fs');

try {
  const content = fs.readFileSync('C:\\Users\\usEr\\.gemini\\antigravity-ide\\brain\\98965f74-1540-44ef-a6ad-314894534dbe\\.system_generated\\logs\\transcript.jsonl', 'utf8');
  const lines = content.split('\n');
  let currentJsonStr = '';
  const steps = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    currentJsonStr += (currentJsonStr ? '\n' : '') + line;
    try {
      const parsed = JSON.parse(currentJsonStr);
      steps.push(parsed);
      currentJsonStr = ''; // successfully parsed, reset
    } catch (e) {
      // continue accumulating
    }
  }
  
  // Filter steps from index 900 to end
  const filtered = steps.filter(s => s.step_index >= 900);
  console.log(`Analyzing ${filtered.length} steps from step 900 onwards:`);
  for (const s of filtered) {
    console.log(`\nStep ${s.step_index} (${s.source} - ${s.type} - ${s.status}):`);
    if (s.tool_calls && s.tool_calls.length > 0) {
      for (const tc of s.tool_calls) {
        console.log(`  Tool: ${tc.name}`);
        if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content' || tc.name === 'write_to_file') {
          console.log(`    TargetFile: ${tc.args.TargetFile || tc.args.TargetFile}`);
          console.log(`    Instruction: ${tc.args.Instruction}`);
          if (tc.args.ReplacementChunks) {
            console.log(`    Chunks: ${JSON.stringify(tc.args.ReplacementChunks.map(c => ({ StartLine: c.StartLine, EndLine: c.EndLine, TargetContent: c.TargetContent, ReplacementContent: c.ReplacementContent })))}`);
          } else if (tc.args.ReplacementContent) {
            console.log(`    TargetContent: ${tc.args.TargetContent}`);
            console.log(`    ReplacementContent: ${tc.args.ReplacementContent}`);
          }
        }
      }
    }
  }
} catch (error) {
  console.error("Error reading/parsing file:", error);
}
