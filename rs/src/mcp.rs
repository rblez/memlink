use anyhow::{Context, Result};
use serde_json::Value;

pub struct McpClient {
    base_url: String,
    client: reqwest::Client,
}

impl McpClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_owned(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn send(&self, method: &str, params: Option<Value>) -> Result<Value> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let resp = self
            .client
            .post(&self.base_url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .json(&body)
            .send()
            .await
            .context("MCP request failed")?;

        let text = resp.text().await?;

        // Parse SSE or JSON response
        if text.starts_with("data:") {
            let json_str = text
                .lines()
                .find(|l| l.starts_with("data:"))
                .and_then(|l| l.strip_prefix("data:"))
                .unwrap_or("");
            Ok(serde_json::from_str(json_str)?)
        } else {
            Ok(serde_json::from_str(&text)?)
        }
    }

    pub async fn list_memories(&self) -> Result<Vec<Value>> {
        Ok(Vec::new())
    }
}
