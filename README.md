# website-feedback-mcp
[![M8ven Score](https://m8ven.ai/badge/mcp/mr-stanis-website-feedback-mcp-ag4cf1?v=2124dc344c36f89d89557b9f90f9d034)](https://m8ven.ai/mcp/mr-stanis-website-feedback-mcp-ag4cf1?s=readme)

MCP server for [Website Feedback Tool](https://websitefeedback.tools/) — a free Chrome extension for leaving visual feedback on live web pages. It lets Claude Code, Cursor, Codex or any MCP client read the design reviews you captured in the browser and fix them in your code.

Each review comes to the agent as Markdown: the comments, the CSS selector of every element, its computed styles, console and network errors, and the screenshots.

## How it works

The MCP server itself is hosted. This package is a small stdio bridge — about 100 lines, no dependencies — that forwards your client's messages to it with your agent key. Use it when your client prefers a local command, or can't send a custom header to a remote server.

If your client supports remote servers with headers, you don't need this package at all; see [Remote setup](#remote-setup).

## Setup

1. Install the [Chrome extension](https://chromewebstore.google.com/detail/website-feedback-tool/oehcjaodegepdlaffmadbfmlomjaenio).
2. In the extension, open **Connect AI agent** and copy your agent key.
3. Add the server to your client.

**Claude Code**

```sh
claude mcp add website-feedback-tool -e WEBSITE_FEEDBACK_KEY=<your-key> -- npx -y website-feedback-mcp
```

**Cursor** (`~/.cursor/mcp.json`), **Claude Desktop** (`claude_desktop_config.json`) and other clients that use the same format:

```json
{
  "mcpServers": {
    "website-feedback-tool": {
      "command": "npx",
      "args": ["-y", "website-feedback-mcp"],
      "env": { "WEBSITE_FEEDBACK_KEY": "<your-key>" }
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.website-feedback-tool]
command = "npx"
args = ["-y", "website-feedback-mcp"]
env = { WEBSITE_FEEDBACK_KEY = "<your-key>" }
```

Treat the key like an API key: keep it in the config file, not in a chat. If the agent stops seeing your reviews, the key changed (reinstall, cleared data, new device) — copy the new one from the extension.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `list_reviews` | — | Your recent reviews, newest first, with the `reviewId` to pass on |
| `get_latest_review` | — | The most recent review as Markdown |
| `get_review` | `reviewId` | One review as Markdown |
| `open_review_link` | `url` | A review from a share link someone sent you |
| `get_screenshot` | `reviewId`, `commentId`, `url` (link-opened reviews only) | A comment's screenshot inline as an image |

Reviews expire 4 days after they are published. Full reference: [websitefeedback.tools/developers](https://websitefeedback.tools/developers/).

## Configuration

| Variable | Required | Meaning |
|---|---|---|
| `WEBSITE_FEEDBACK_KEY` | for tool calls | Agent key from the extension (Connect AI agent) |
| `WEBSITE_FEEDBACK_ENDPOINT` | no | Server URL. Leave unset unless the extension shows you a different endpoint for your region |

Without a key the server still answers the handshake and lists its tools; every tool call returns an error explaining where to get the key.

## Remote setup

Clients that support remote MCP servers can connect directly. The extension's **Connect AI agent** screen shows the ready-to-run command with the right endpoint for your region, for example:

```sh
claude mcp add --scope user --transport http website-feedback-tool <endpoint> --header "Authorization: Bearer <your-key>"
```

## Privacy

The bridge stores nothing and sends nothing anywhere except the configured endpoint. Each agent key only ever sees the reviews pushed from the browser profile that created it.

## License

MIT © Stanmash Ltd
