# Skill: MoAI Tool

Source: modu-ai-moai-adk-moai-tool-opencode (via SkillHub)

MoAI (Model of Artificial Intelligence) tool integration for OpenCode.

## Commands

- Tool invocation: Call MoAI tools properly
- Context management: Handle tool context
- Response processing: Parse tool outputs
- Error handling: Manage tool failures

## MoAI Integration

MoAI provides standardized interfaces for:
- Data processing
- Model inference
- Tool orchestration
- Result aggregation

## Usage Patterns

1. **Direct Tool Calls**
   ```
   Use tool with specific parameters
   Process tool response
   Take action based on result
   ```

2. **Chained Operations**
   ```
   Tool A output → Tool B input
   Process intermediate results
   Aggregate final output
   ```

3. **Parallel Execution**
   ```
   Call multiple tools simultaneously
   Collect all results
   Synthesize responses
   ```

## Best Practices

- Validate inputs before tool calls
- Handle timeouts gracefully
- Cache results when appropriate
- Log tool usage for debugging
